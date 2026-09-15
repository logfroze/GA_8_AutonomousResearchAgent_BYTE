"""LLM client. API-specific details stay in this module."""

from __future__ import annotations

import logging
import os

import requests

from .extractive import extractive_report
from .scraper import ScrapedSource
from .utils import ResearchError

logger = logging.getLogger(__name__)

DEFAULT_BASE_URL = "https://api.x.ai/v1"
DEFAULT_MODEL = "grok-4.5"
MAX_TOKENS = 2400
REQUEST_TIMEOUT = 90


SYSTEM_PROMPT = """You are a careful research analyst.

You will be given a research topic and the cleaned text of a small number of web sources.

Rules you must follow:
- Use ONLY the supplied source material. Do not add facts, numbers, dates, quotes, or claims that are not supported by those sources.
- Combine overlapping points instead of repeating them. Remove redundant / duplicated information.
- When sources disagree, say so plainly and attribute each view.
- If the sources are thin, say what is missing rather than filling gaps with general knowledge.
- Write a structured Markdown report with these sections, in this order:
  1. # Research Report: <Topic>
  2. ## Executive Summary  (one short paragraph)
  3. ## Key Findings  (3–6 findings as ### Finding N headings)
  4. ## Detailed Analysis  (thematic subsections, not source-by-source copypaste)
  5. ## Conclusion
  Do NOT include a Sources section — the application appends real URLs itself.
- Keep a professional, neutral tone. Do not pad with buzzwords.
- Do not invent URLs.
"""


def get_api_key() -> str | None:
    return (
        os.getenv("LLM_API_KEY")
        or os.getenv("XAI_API_KEY")
        or os.getenv("OPENAI_API_KEY")
        or None
    )


def synthesize_report(topic: str, sources: list[ScrapedSource]) -> str:
    usable = [s for s in sources if s.content.strip()]
    if not usable:
        raise ResearchError(
            "None of the selected pages produced usable text, so a report could not be written."
        )

    api_key = get_api_key()
    if not api_key:
        logger.warning("No LLM API key set; writing an extractive report from the sources.")
        return extractive_report(topic, usable)

    try:
        return _call_llm(topic, usable, api_key)
    except ResearchError as exc:
        message = str(exc).lower()
        if "api key" in message and "rejected" in message:
            raise
        logger.warning("LLM unavailable (%s); writing an extractive report from the sources.", exc)
        return extractive_report(topic, usable)


def _call_llm(topic: str, sources: list[ScrapedSource], api_key: str) -> str:
    base_url = os.getenv("LLM_BASE_URL", DEFAULT_BASE_URL).rstrip("/")
    model = os.getenv("LLM_MODEL", DEFAULT_MODEL)

    payload = {
        "model": model,
        "temperature": 0.2,
        "max_tokens": MAX_TOKENS,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": _build_user_prompt(topic, sources)},
        ],
    }

    try:
        response = requests.post(
            f"{base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=REQUEST_TIMEOUT,
        )
    except requests.Timeout:
        raise ResearchError("The language model timed out. Please try again.") from None
    except requests.RequestException as exc:
        raise ResearchError(f"Could not reach the language model API: {exc}") from exc

    if response.status_code == 401:
        raise ResearchError("The LLM API key was rejected. Check LLM_API_KEY in your .env file.")
    if response.status_code >= 400:
        detail = _safe_error(response)
        raise ResearchError(f"LLM API error ({response.status_code}): {detail}")

    try:
        data = response.json()
        text = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, ValueError) as exc:
        raise ResearchError("The language model returned an unexpected response.") from exc

    if not text or not text.strip():
        raise ResearchError("The language model returned an empty report.")
    return text.strip()


def _build_user_prompt(topic: str, sources: list[ScrapedSource]) -> str:
    blocks = [f"Research topic: {topic}", "", "Source material:", ""]
    for index, source in enumerate(sources, start=1):
        blocks.append(f"----- SOURCE {index} -----")
        blocks.append(f"Title: {source.title}")
        blocks.append(f"URL: {source.url}")
        blocks.append("")
        blocks.append(source.content)
        blocks.append("")
    blocks.append(
        "Write the research report now. Deduplicate repeated points. "
        "Stay within the source material."
    )
    return "\n".join(blocks)


def _safe_error(response: requests.Response) -> str:
    try:
        data = response.json()
        if isinstance(data, dict):
            err = data.get("error")
            if isinstance(err, dict):
                return str(err.get("message") or err)[:240]
            if err:
                return str(err)[:240]
    except ValueError:
        pass
    return (response.text or "")[:240]
