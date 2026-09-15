"""Orchestrate search → select → scrape → synthesize → save."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from .llm import synthesize_report
from .report import build_report, default_report_path, save_report
from .scraper import ScrapedSource, scrape_sources
from .search import SearchError, SearchResult, search_web
from .utils import ResearchError, validate_topic

logger = logging.getLogger(__name__)

ProgressFn = Callable[[int, int, str], None]


@dataclass
class ResearchResult:
    topic: str
    selected: list[SearchResult]
    sources: list[ScrapedSource]
    report_markdown: str
    report_path: Path
    warnings: list[str] = field(default_factory=list)


def run_research(
    topic: str,
    reports_dir: Path,
    output_path: Path | None = None,
    on_progress: ProgressFn | None = None,
) -> ResearchResult:
    """Run the full research workflow for one topic."""
    topic = validate_topic(topic)
    warnings: list[str] = []

    def progress(step: int, message: str) -> None:
        if on_progress:
            on_progress(step, 5, message)

    progress(1, "Searching the web...")
    try:
        selected = search_web(topic, limit=3)
    except SearchError as exc:
        raise ResearchError(str(exc)) from exc
    except Exception as exc:
        logger.exception("Search failed")
        raise ResearchError(f"Web search failed: {exc}") from exc

    progress(2, "Selecting top 3 sources...")
    if not selected:
        raise ResearchError("No relevant articles were found for that topic.")

    progress(3, "Extracting article content...")
    sources = scrape_sources(selected)
    usable = [s for s in sources if s.content.strip()]
    for source in sources:
        if source.error:
            warnings.append(f"{source.url} — {source.error}")
    if not usable:
        raise ResearchError(
            "The selected pages could not be read (timeout, block, or empty content). "
            "Try a different topic."
        )

    progress(4, "Synthesizing research...")
    try:
        draft = synthesize_report(topic, usable)
    except ResearchError:
        raise
    except Exception as exc:
        logger.exception("LLM synthesis failed")
        raise ResearchError(f"Report synthesis failed: {exc}") from exc

    progress(5, "Generating report...")
    markdown = build_report(topic, draft, usable)
    path = output_path or default_report_path(topic, reports_dir)
    try:
        save_report(markdown, path)
    except Exception as exc:
        raise ResearchError(str(exc)) from exc

    return ResearchResult(
        topic=topic,
        selected=selected,
        sources=sources,
        report_markdown=markdown,
        report_path=path,
        warnings=warnings,
    )
