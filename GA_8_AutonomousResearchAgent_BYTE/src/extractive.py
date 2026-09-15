"""Extractive fallback: a structured report from source sentences only.

Used when the LLM API is missing or rejects the request. Nothing is invented —
sentences come from the scraped pages, duplicates are dropped by token overlap.
"""

from __future__ import annotations

import re

from .scraper import ScrapedSource
from .utils import tokenize

_SENT_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z“\"])")
_JUNK = re.compile(
    r"(article sidebar|main article content|cookie|subscribe|sign in|log in|"
    r"accept all|related articles|share this|advertisement)",
    re.I,
)


def extractive_report(topic: str, sources: list[ScrapedSource]) -> str:
    bundles = [_source_sentences(source) for source in sources if source.content.strip()]
    all_sents: list[tuple[str, str]] = [(s, b["title"]) for b in bundles for s in b["sentences"]]
    selected = _select_diverse(topic, all_sents, k=18)

    summary = _join_unique(selected[:4])
    findings = selected[1:7] if len(selected) > 6 else selected[:5]
    if not findings:
        findings = selected[:3]

    parts = [
        f"# Research Report: {topic}",
        "",
        "## Executive Summary",
        "",
        summary or "The selected sources did not contain enough overlapping, usable prose to summarise.",
        "",
        "## Key Findings",
        "",
    ]
    for i, (sentence, title) in enumerate(findings, start=1):
        parts.append(f"### Finding {i}")
        parts.append("")
        parts.append(f"{sentence} _(Source: {title})_")
        parts.append("")

    parts.append("## Detailed Analysis")
    parts.append("")
    parts.append(
        "The notes below stay close to the extracted source text. "
        "Repeated claims across pages were dropped so each point appears once."
    )
    parts.append("")

    used = {s for s, _ in findings}
    for bundle in bundles:
        leftover = [s for s in bundle["sentences"] if s not in used]
        leftover = _dedupe_list(leftover)[:6]
        if not leftover:
            continue
        parts.append(f"### {bundle['title']}")
        parts.append("")
        parts.append(" ".join(leftover))
        parts.append("")
        used.update(leftover)

    conclusion_pool = selected[-3:] if len(selected) >= 3 else selected
    conclusion = _join_unique(conclusion_pool)
    parts.append("## Conclusion")
    parts.append("")
    parts.append(
        conclusion
        or f"Across the collected sources, the material on “{topic}” is limited to the pages listed below."
    )
    parts.append("")
    return "\n".join(parts).strip() + "\n"


def _clean_sentence(piece: str) -> str:
    piece = re.sub(r"\s+", " ", piece).strip(" \t.:;)(")
    if piece.startswith(")"):
        piece = piece.lstrip(") ").strip()
    if not piece.endswith((".", "!", "?")):
        piece = piece + "."
    return piece[0].upper() + piece[1:] if piece else piece


def _is_junk(piece: str) -> bool:
    if len(piece) < 60 or len(piece) > 320:
        return True
    if piece.lower().startswith("http"):
        return True
    if _JUNK.search(piece):
        return True
    if len(piece.split()) < 10:
        return True
    return False


def _source_sentences(source: ScrapedSource) -> dict:
    text = source.content
    text = re.sub(r"^\(Full page could not be extracted:[^)]+\)\s*", "", text)
    raw = _SENT_SPLIT.split(text.replace("\n", " "))
    sentences = []
    for piece in raw:
        piece = _clean_sentence(piece)
        if not _is_junk(piece):
            sentences.append(piece)
    return {"title": source.title, "url": source.url, "sentences": sentences[:40]}


def _select_diverse(topic: str, items: list[tuple[str, str]], k: int) -> list[tuple[str, str]]:
    terms = tokenize(topic)
    scored: list[tuple[float, str, str]] = []
    for sentence, title in items:
        tokens = tokenize(sentence)
        if not tokens:
            continue
        overlap = len(terms & tokens) / max(len(terms), 1)
        density = min(len(sentence) / 180, 1.0)
        scored.append((0.7 * overlap + 0.3 * density, sentence, title))
    scored.sort(reverse=True)

    picked: list[tuple[str, str]] = []
    for _, sentence, title in scored:
        if any(_too_similar(sentence, existing) for existing, _ in picked):
            continue
        picked.append((sentence, title))
        if len(picked) >= k:
            break
    return picked


def _too_similar(a: str, b: str, threshold: float = 0.55) -> bool:
    ta, tb = tokenize(a), tokenize(b)
    if not ta or not tb:
        return False
    return len(ta & tb) / len(ta | tb) >= threshold


def _dedupe_list(sentences: list[str]) -> list[str]:
    kept: list[str] = []
    for sentence in sentences:
        if any(_too_similar(sentence, existing) for existing in kept):
            continue
        kept.append(sentence)
    return kept


def _join_unique(items: list[tuple[str, str]]) -> str:
    return " ".join(sentence for sentence, _ in _dedupe_list_pairs(items))


def _dedupe_list_pairs(items: list[tuple[str, str]]) -> list[tuple[str, str]]:
    kept: list[tuple[str, str]] = []
    for sentence, title in items:
        if any(_too_similar(sentence, existing) for existing, _ in kept):
            continue
        kept.append((sentence, title))
    return kept
