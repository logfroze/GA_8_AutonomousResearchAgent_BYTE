#!/usr/bin/env python3
"""Autonomous Research Agent — BYTE AVIP 2026 Generative AI Task 8.

Usage:
    python main.py
    python main.py --topic "Impact of artificial intelligence on software development"
    python main.py --topic "..." --output reports/sample_report_1.md
    python main.py --topic "..." --json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.researcher import run_research
from src.utils import ResearchError

REPORTS_DIR = ROOT / "reports"


def main(argv: list[str] | None = None) -> int:
    load_dotenv(ROOT / ".env")
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.WARNING if args.json else logging.INFO,
        format="%(levelname)s: %(message)s",
    )

    _print_banner(quiet=args.json)

    topic = (args.topic or "").strip()
    if not topic:
        if args.json:
            _emit_json({"ok": False, "error": "Please enter a research topic."})
            return 1
        try:
            topic = input("Enter research topic:\n> ").strip()
        except EOFError:
            print("\nNo topic received. Exiting.")
            return 1

    output = Path(args.output) if args.output else None
    if output and not output.is_absolute():
        output = ROOT / output

    def on_progress(step: int, total: int, message: str) -> None:
        if args.json:
            print(f"[{step}/{total}] {message}", file=sys.stderr, flush=True)
        else:
            print(f"[{step}/{total}] {message}", flush=True)

    try:
        result = run_research(
            topic=topic,
            reports_dir=REPORTS_DIR,
            output_path=output,
            on_progress=on_progress,
        )
    except ResearchError as exc:
        if args.json:
            _emit_json({"ok": False, "error": str(exc)})
        else:
            print(f"\nCould not complete research: {exc}")
        return 1
    except KeyboardInterrupt:
        print("\nCancelled.")
        return 130

    rel_path = _display_path(result.report_path)

    if args.json:
        _emit_json(
            {
                "ok": True,
                "topic": result.topic,
                "report_path": str(result.report_path),
                "report_markdown": result.report_markdown,
                "warnings": result.warnings,
                "sources": [
                    {
                        "title": s.title,
                        "url": s.url,
                        "ok": s.ok,
                        "error": s.error,
                        "char_count": s.char_count,
                    }
                    for s in result.sources
                ],
                "selected": [r.to_dict() for r in result.selected],
            }
        )
        return 0

    print()
    print("Research complete!")
    print()
    print("Report saved to:")
    print(rel_path)
    print()
    print("Sources:")
    for index, source in enumerate(result.selected, start=1):
        print(f"  {index}. {source.title}")
        print(f"     {source.url}")
    if result.warnings:
        print()
        print("Notes:")
        for warning in result.warnings:
            print(f"  - {warning}")
    print()
    return 0


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Autonomous Research Agent — search, read, and synthesize a Markdown report."
    )
    parser.add_argument("--topic", "-t", help="Research topic (skips the interactive prompt)")
    parser.add_argument("--output", "-o", help="Markdown output path")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print a JSON result on stdout (progress goes to stderr)",
    )
    return parser.parse_args(argv)


def _print_banner(quiet: bool) -> None:
    if quiet:
        return
    print("========================================")
    print("   Autonomous Research Agent")
    print("========================================")
    print()


def _display_path(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


def _emit_json(payload: dict) -> None:
    json.dump(payload, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    sys.exit(main())
