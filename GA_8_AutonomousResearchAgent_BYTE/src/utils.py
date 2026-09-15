"""Shared helpers: validation, URL hygiene, text cleaning, filenames."""

from __future__ import annotations

import re
import unicodedata
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

WIKI_USER_AGENT = (
    "AutonomousResearchAgent/1.0 (BYTE AVIP 2026 internship project; educational use)"
)

REQUEST_TIMEOUT = 12

SKIP_DOMAINS = {
    "youtube.com",
    "youtu.be",
    "facebook.com",
    "instagram.com",
    "pinterest.com",
    "tiktok.com",
    "twitter.com",
    "x.com",
    "duckduckgo.com",
    "google.com",
    "bing.com",
}

HARD_SCRAPE_DOMAINS = {
    "academia.edu",
    "researchgate.net",
    "sciencedirect.com",
    "ieeexplore.ieee.org",
    "link.springer.com",
    "jstor.org",
    "wiley.com",
    "onlinelibrary.wiley.com",
    "doi.org",
    "dx.doi.org",
}

TRACKING_PARAMS = {
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "fbclid",
    "mc_cid",
    "mc_eid",
}

_TOKEN_RE = re.compile(r"[a-z0-9]+")
_WHITESPACE_RE = re.compile(r"[ \t\u00a0]+")
_MULTI_NL_RE = re.compile(r"\n{3,}")


class ResearchError(Exception):
    """User-facing error with a clear message (not a raw traceback)."""


def validate_topic(topic: str) -> str:
    cleaned = " ".join((topic or "").split())
    if not cleaned:
        raise ResearchError("Please enter a research topic.")
    if len(cleaned) < 3:
        raise ResearchError("Topic is too short. Please enter a more specific research topic.")
    if len(cleaned) > 240:
        raise ResearchError("Topic is too long. Please keep it under 240 characters.")
    return cleaned


def tokenize(text: str) -> set[str]:
    return {tok for tok in _TOKEN_RE.findall((text or "").lower()) if len(tok) > 2}


def is_valid_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
    except Exception:
        return False
    if parsed.scheme not in {"http", "https"}:
        return False
    if not parsed.netloc or "." not in parsed.netloc:
        return False
    return True


def hostname(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host


def is_skipped_domain(url: str) -> bool:
    host = hostname(url)
    return any(host == d or host.endswith("." + d) for d in SKIP_DOMAINS)


def is_hard_scrape(url: str) -> bool:
    host = hostname(url)
    return any(host == d or host.endswith("." + d) for d in HARD_SCRAPE_DOMAINS)


def normalize_url(url: str) -> str:
    """Strip fragments and tracking query params so duplicates collapse."""
    parsed = urlparse(url.strip())
    query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in TRACKING_PARAMS
    ]
    cleaned = parsed._replace(
        scheme=parsed.scheme.lower(),
        netloc=parsed.netloc.lower(),
        fragment="",
        query=urlencode(query),
    )
    return urlunparse(cleaned).rstrip("/")


def clean_whitespace(text: str) -> str:
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n")
    text = _WHITESPACE_RE.sub(" ", text)
    text = _MULTI_NL_RE.sub("\n\n", text)
    lines = [line.strip() for line in text.split("\n")]
    return "\n".join(lines).strip()


def slugify(text: str, max_length: int = 60) -> str:
    normalized = unicodedata.normalize("NFKD", text or "")
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text).strip("-").lower()
    return (slug or "research-report")[:max_length].rstrip("-")


def relevance_score(topic: str, title: str, snippet: str, url: str = "") -> float:
    """Score a search hit so we pick relevant articles, not random ones."""
    terms = tokenize(topic)
    if not terms:
        return 0.0
    title_terms = tokenize(title)
    snippet_terms = tokenize(snippet)
    title_hit = len(terms & title_terms) / len(terms)
    snippet_hit = len(terms & snippet_terms) / len(terms)
    bonus = 0.0
    host = hostname(url)
    if host.endswith(".edu") or host.endswith(".gov"):
        bonus += 0.16
    elif "wikipedia.org" in host:
        bonus += 0.12
    elif host.endswith(".org"):
        bonus += 0.06
    if url.lower().endswith(".pdf"):
        bonus -= 0.08
    if is_hard_scrape(url):
        bonus -= 0.35
    return round(0.55 * title_hit + 0.35 * snippet_hit + bonus, 4)
