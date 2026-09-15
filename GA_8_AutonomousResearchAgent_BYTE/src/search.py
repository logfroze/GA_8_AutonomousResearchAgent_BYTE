"""Web search: DuckDuckGo first, then open scholarly/encyclopedia fallbacks."""

from __future__ import annotations

import html
import logging
import re
from dataclasses import asdict, dataclass
from urllib.parse import quote

import requests

from .utils import (
    REQUEST_TIMEOUT,
    USER_AGENT,
    WIKI_USER_AGENT,
    hostname,
    is_skipped_domain,
    is_valid_url,
    normalize_url,
    relevance_score,
    tokenize,
    validate_topic,
)

logger = logging.getLogger(__name__)

HEADERS = {"User-Agent": USER_AGENT, "Accept": "application/json"}
WIKI_HEADERS = {"User-Agent": WIKI_USER_AGENT, "Accept": "application/json"}
_TAG_RE = re.compile(r"<[^>]+>")


@dataclass
class SearchResult:
    title: str
    url: str
    snippet: str
    score: float = 0.0
    provider: str = ""

    def to_dict(self) -> dict:
        return asdict(self)


class SearchError(Exception):
    """Raised when search cannot produce usable results."""


def search_web(topic: str, limit: int = 3) -> list[SearchResult]:
    """Search the web and return the top `limit` relevant, unique results."""
    query = validate_topic(topic)
    collected: list[SearchResult] = []

    collected.extend(_search_duckduckgo(query, max_results=10))
    if len(collected) < 8:
        collected.extend(_search_wikipedia(query, max_results=5))
    if len(collected) < 8:
        collected.extend(_search_openalex(query, max_results=5))
    if len(collected) < 5:
        collected.extend(_search_hackernews(query, max_results=5))

    ranked = _rank_and_dedupe(query, collected)
    if not ranked:
        raise SearchError(
            "No usable search results were found for that topic. "
            "Try a more specific, well-known subject."
        )
    return ranked[:limit]


def _search_duckduckgo(query: str, max_results: int) -> list[SearchResult]:
    try:
        from ddgs import DDGS
    except ImportError:
        logger.warning("ddgs is not installed; skipping DuckDuckGo search.")
        return []

    try:
        raw = list(DDGS().text(query, max_results=max_results))
    except Exception as exc:
        logger.warning("DuckDuckGo search failed: %s", exc)
        return []

    results: list[SearchResult] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = (item.get("title") or "").strip()
        url = (item.get("href") or item.get("url") or "").strip()
        snippet = (item.get("body") or item.get("snippet") or "").strip()
        parsed = _candidate(title, url, snippet, "duckduckgo")
        if parsed:
            results.append(parsed)
    logger.info("DuckDuckGo returned %s usable hits", len(results))
    return results


def _search_wikipedia(query: str, max_results: int) -> list[SearchResult]:
    url = (
        "https://en.wikipedia.org/w/api.php"
        f"?action=query&list=search&srsearch={quote(query)}"
        f"&srlimit={max_results}&format=json&utf8=1"
    )
    try:
        data = _get_json(url, headers=WIKI_HEADERS)
        hits = data.get("query", {}).get("search", [])
    except Exception as exc:
        logger.warning("Wikipedia search failed: %s", exc)
        return []

    results: list[SearchResult] = []
    for hit in hits:
        title = (hit.get("title") or "").strip()
        if not title:
            continue
        page_url = "https://en.wikipedia.org/wiki/" + quote(title.replace(" ", "_"))
        snippet = _strip_html(hit.get("snippet") or "")
        parsed = _candidate(title, page_url, snippet, "wikipedia")
        if parsed:
            results.append(parsed)
    return results


def _search_openalex(query: str, max_results: int) -> list[SearchResult]:
    url = (
        "https://api.openalex.org/works"
        f"?search={quote(query)}&per_page={max_results}"
    )
    try:
        data = _get_json(url)
        works = data.get("results", [])
    except Exception as exc:
        logger.warning("OpenAlex search failed: %s", exc)
        return []

    results: list[SearchResult] = []
    for work in works:
        title = (work.get("display_name") or "").strip()
        location = work.get("primary_location") or {}
        source_url = ""
        if isinstance(location, dict):
            source_url = location.get("landing_page_url") or ""
        if not source_url:
            source_url = work.get("doi") or work.get("id") or ""
        if isinstance(source_url, str) and source_url.startswith("10."):
            source_url = "https://doi.org/" + source_url
        abstract = _inflate_abstract(work.get("abstract_inverted_index"))
        snippet = abstract[:280] if abstract else title
        parsed = _candidate(title, source_url, snippet, "openalex")
        if parsed:
            results.append(parsed)
    return results


def _search_hackernews(query: str, max_results: int) -> list[SearchResult]:
    url = (
        "https://hn.algolia.com/api/v1/search"
        f"?query={quote(query)}&tags=story&hitsPerPage={max_results}"
    )
    try:
        data = _get_json(url)
        hits = data.get("hits", [])
    except Exception as exc:
        logger.warning("Hacker News search failed: %s", exc)
        return []

    results: list[SearchResult] = []
    for hit in hits:
        title = (hit.get("title") or "").strip()
        source_url = (hit.get("url") or "").strip()
        snippet = (hit.get("story_text") or title).strip()
        parsed = _candidate(title, source_url, snippet, "hackernews")
        if parsed:
            results.append(parsed)
    return results


def _candidate(title: str, url: str, snippet: str, provider: str) -> SearchResult | None:
    if not title or not url:
        return None
    if not is_valid_url(url):
        return None
    if is_skipped_domain(url):
        return None
    if url.lower().endswith(".pdf"):
        return None
    return SearchResult(
        title=title[:240],
        url=normalize_url(url),
        snippet=snippet[:400],
        provider=provider,
    )


def _rank_and_dedupe(topic: str, results: list[SearchResult]) -> list[SearchResult]:
    seen_urls: set[str] = set()
    seen_hosts: dict[str, int] = {}
    ranked: list[SearchResult] = []
    scored: list[SearchResult] = []

    for item in results:
        key = item.url.lower()
        if key in seen_urls:
            continue
        seen_urls.add(key)
        item.score = relevance_score(topic, item.title, item.snippet, item.url)
        scored.append(item)

    scored.sort(key=lambda r: r.score, reverse=True)
    topic_terms = tokenize(topic)

    for item in scored:
        host = hostname(item.url)
        if seen_hosts.get(host, 0) >= 2:
            continue
        if item.score < 0.08 and "wikipedia.org" not in host and not host.endswith(".gov"):
            continue
        if ranked and not (topic_terms & tokenize(item.title)) and item.score < 0.2:
            continue
        seen_hosts[host] = seen_hosts.get(host, 0) + 1
        ranked.append(item)
    return ranked


def _get_json(url: str, headers: dict | None = None) -> dict:
    response = requests.get(url, headers=headers or HEADERS, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()


def _strip_html(value: str) -> str:
    return html.unescape(_TAG_RE.sub("", value or "")).strip()


def _inflate_abstract(inverted: object) -> str:
    if not isinstance(inverted, dict):
        return ""
    positions: list[tuple[int, str]] = []
    for word, indexes in inverted.items():
        if not isinstance(indexes, list):
            continue
        for index in indexes:
            if isinstance(index, int):
                positions.append((index, str(word)))
    positions.sort()
    return " ".join(word for _, word in positions)
