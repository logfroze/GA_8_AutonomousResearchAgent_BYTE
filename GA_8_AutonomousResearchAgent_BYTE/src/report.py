"""Save a structured Markdown report and attach the real source URLs."""

from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path

from .scraper import ScrapedSource
from .utils import slugify

SOURCES_HEADING_RE = re.compile(r"\n##\s+Sources\b.*\Z", re.IGNORECASE | re.DOTALL)


def build_report(topic: str, llm_markdown: str, sources: list[ScrapedSource]) -> str:
    """Combine the model draft with an authoritative Sources section."""
    body = SOURCES_HEADING_RE.sub("", llm_markdown.strip()).rstrip()
    if not body.lower().startswith("# research report"):
        body = f"# Research Report: {topic}\n\n{body}"

    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    source_lines = ["## Sources", ""]
    for index, source in enumerate(sources, start=1):
        title = source.title.replace("[", "(").replace("]", ")")
        source_lines.append(f"{index}. [{title}]({source.url})")
    source_lines.append("")
    source_lines.append(f"_Generated {generated} by the Autonomous Research Agent._")

    return body + "\n\n" + "\n".join(source_lines) + "\n"


def save_report(markdown: str, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        path.write_text(markdown, encoding="utf-8")
    except OSError as exc:
        raise ReportWriteError(f"Could not write the report to {path}: {exc}") from exc
    return path


def default_report_path(topic: str, reports_dir: Path) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    return reports_dir / f"{stamp}_{slugify(topic)}.md"


class ReportWriteError(Exception):
    """Raised when the Markdown file cannot be written."""
