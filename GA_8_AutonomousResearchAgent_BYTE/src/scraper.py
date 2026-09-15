"""Fetch selected pages and extract readable article text."""

from __future__ import annotations

import logging
from dataclasses import asdict, dataclass
from urllib.parse import quote, unquote

import requests
from bs4 import BeautifulSoup

from .utils import REQUEST_TIMEOUT, USER_AGENT, WIKI_USER_AGENT, clean_whitespace, hostname

logger = logging.getLogger(__name__)

MIN_USABLE_CHARS = 220
MAX_CONTENT_CHARS = 9000

NOISE_TAGS = [
    "script",
    "style",
    "noscript",
    "iframe",
    "svg",
    "canvas",
    "form",
    "nav",
    "footer",
    "header",
    "aside",
    "button",
    "input",
]

NOISE_SELECTORS = [
    "[role='navigation']",
    "[role='banner']",
    "[role='contentinfo']",
    "[role='search']",
    ".sidebar",
    ".nav",
    ".navbar",
    ".menu",
    ".footer",
    ".header",
    ".advert",
    ".ads",
    ".ad",
    ".cookie",
    ".share",
    ".social",
    ".comments",
    "#comments",
]


@dataclass
class ScrapedSource:
    title: str
    url: str
    content: str
    ok: bool
    error: str | None = None
    char_count: int = 0

    def to_dict(self) -> dict:
        return asdict(self)


def scrape_sources(results: list) -> list[ScrapedSource]:
    """Download and clean each selected result. Failures do not abort the run."""
    scraped: list[ScrapedSource] = []
    for result in results:
        scraped.append(scrape_one(result.title, result.url, getattr(result, "snippet", "")))
    return scraped


def scrape_one(title: str, url: str, snippet: str = "") -> ScrapedSource:
    host = hostname(url)

    if "wikipedia.org" in host:
        wiki = _scrape_wikipedia(title, url)
        if wiki.ok:
            return wiki

    try:
        response = requests.get(
            url,
            headers={
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
            timeout=REQUEST_TIMEOUT,
            allow_redirects=True,
        )
    except requests.Timeout:
        return _fallback(title, url, snippet, f"Timed out after {REQUEST_TIMEOUT}s ({host})")
    except requests.RequestException as exc:
        return _fallback(title, url, snippet, f"Could not fetch {host}: {exc.__class__.__name__}")

    if response.status_code >= 400:
        return _fallback(title, url, snippet, f"{host} returned HTTP {response.status_code}")

    content_type = (response.headers.get("Content-Type") or "").lower()
    if "pdf" in content_type or url.lower().endswith(".pdf"):
        return _fallback(title, url, snippet, "PDF files are skipped (HTML articles only)")

    if response.encoding is None or response.encoding.lower() in {"iso-8859-1", "ascii"}:
        response.encoding = response.apparent_encoding or "utf-8"

    page_title, text = extract_readable_text(response.text, fallback_title=title)
    if len(text) < MIN_USABLE_CHARS:
        return _fallback(
            title or page_title,
            url,
            snippet,
            f"Not enough readable article text on {host}",
        )

    return ScrapedSource(
        title=page_title or title,
        url=url,
        content=text[:MAX_CONTENT_CHARS],
        ok=True,
        char_count=min(len(text), MAX_CONTENT_CHARS),
    )


def extract_readable_text(html: str, fallback_title: str = "") -> tuple[str, str]:
    soup = BeautifulSoup(html, "lxml")

    title = fallback_title
    if soup.title and soup.title.string:
        title = soup.title.string.strip() or fallback_title
    heading = soup.find(["h1"])
    if heading:
        heading_text = heading.get_text(" ", strip=True)
        if heading_text:
            title = heading_text

    for tag in soup(NOISE_TAGS):
        tag.decompose()
    for selector in NOISE_SELECTORS:
        for node in soup.select(selector):
            node.decompose()

    article = (
        soup.find("article")
        or soup.find("main")
        or soup.find(attrs={"role": "main"})
        or soup.find(class_="post-content")
        or soup.find(class_="article-body")
        or soup.find(id="content")
        or soup.body
        or soup
    )

    paragraphs = []
    for node in article.find_all(["p", "h2", "h3", "li"]):
        piece = node.get_text(" ", strip=True)
        if len(piece) < 40 and node.name == "p":
            continue
        if piece:
            paragraphs.append(piece)

    text = clean_whitespace("\n\n".join(paragraphs))
    if len(text) < MIN_USABLE_CHARS:
        text = clean_whitespace(article.get_text("\n", strip=True))
    return title, text


def _scrape_wikipedia(title: str, url: str) -> ScrapedSource:
    page_title = title
    if "/wiki/" in url:
        page_title = unquote(url.rsplit("/wiki/", 1)[-1]).replace("_", " ")
    api = (
        "https://en.wikipedia.org/w/api.php"
        "?action=query&prop=extracts&explaintext=1&exsectionformat=plain"
        f"&titles={quote(page_title)}&format=json"
    )
    try:
        response = requests.get(
            api,
            headers={"User-Agent": WIKI_USER_AGENT},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        pages = response.json().get("query", {}).get("pages", {})
        page = next(iter(pages.values()), {})
        extract = clean_whitespace(page.get("extract") or "")
        resolved_title = page.get("title") or title
        if len(extract) < MIN_USABLE_CHARS:
            return ScrapedSource(
                title=resolved_title, url=url, content="", ok=False, error="empty Wikipedia extract"
            )
        return ScrapedSource(
            title=resolved_title,
            url=url,
            content=extract[:MAX_CONTENT_CHARS],
            ok=True,
            char_count=min(len(extract), MAX_CONTENT_CHARS),
        )
    except Exception as exc:
        logger.warning("Wikipedia extract failed for %s: %s", url, exc)
        return ScrapedSource(title=title, url=url, content="", ok=False, error=str(exc))


def _fallback(title: str, url: str, snippet: str, error: str) -> ScrapedSource:
    logger.warning("Scrape failed for %s — %s", url, error)
    snippet = clean_whitespace(snippet)
    if len(snippet) >= 80:
        return ScrapedSource(
            title=title,
            url=url,
            content=f"(Full page could not be extracted: {error})\n\n{snippet}",
            ok=True,
            error=error,
            char_count=len(snippet),
        )
    return ScrapedSource(title=title, url=url, content="", ok=False, error=error)
