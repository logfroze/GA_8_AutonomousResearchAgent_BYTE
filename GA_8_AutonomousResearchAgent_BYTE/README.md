# Autonomous Research Agent

BYTE by Arithmatrix · AVIP 2026 · Generative AI Task 8

An autonomous research agent. You give it a topic. It searches the web, selects the three most relevant articles, extracts and cleans their text, and asks a language model to synthesize a structured Markdown report — with the original source URLs attached.

The only required input is the topic.

```text
Impact of artificial intelligence on software development
        ↓
Search → rank → top 3 articles → scrape → clean → LLM synthesis → Markdown report
```

## Features

- Web search (DuckDuckGo, with Wikipedia / OpenAlex fallbacks)
- Relevance ranking and selection of the top 3 sources
- Webpage download and readable-text extraction
- Content cleaning (scripts, navigation, clutter, extra whitespace)
- LLM-powered synthesis that is instructed not to invent facts
- Duplicate / repeated information is reduced in the prompt and the draft
- Structured Markdown report generation
- Original source URLs preserved (the application writes the Sources section itself)

## Tech Stack

- Python 3.10+
- DuckDuckGo search via [`ddgs`](https://pypi.org/project/ddgs/)
- `requests` + BeautifulSoup4 for scraping
- OpenAI-compatible LLM API (defaults to xAI Grok)
- `python-dotenv` for credentials

## Project Structure

```text
GA_8_AutonomousResearchAgent_BYTE/
├── src/
│   ├── search.py        Web search, ranking, top-3 selection
│   ├── scraper.py       Fetch pages and extract readable text
│   ├── researcher.py    Orchestrates the full pipeline
│   ├── llm.py           LLM client and research prompt
│   ├── extractive.py    Source-sentence fallback if the LLM is down
│   ├── report.py        Markdown assembly and file output
│   └── utils.py         Validation, URL hygiene, text cleaning
├── reports/             Sample reports and generated output
├── assets/screenshots/  CLI and workflow captures
├── main.py              Command-line entry point
├── requirements.txt
├── .env.example
└── LICENSE
```

## Installation

```bash
git clone <repository-url>
cd GA_8_AutonomousResearchAgent_BYTE

python3 -m venv venv
```

Linux / macOS:

```bash
source venv/bin/activate
```

Windows:

```bash
venv\Scripts\activate
```

```bash
pip install -r requirements.txt
```

## Environment Variables

Copy the example file and add your key. Never commit `.env`.

```bash
cp .env.example .env
```

```text
LLM_API_KEY=your_api_key_here
LLM_BASE_URL=https://api.x.ai/v1
LLM_MODEL=grok-4.5
```

DuckDuckGo does not need a search key. `SEARCH_API_KEY` is only used if you switch the search module to SerpAPI.

The agent also accepts `XAI_API_KEY` as an alias for `LLM_API_KEY`.

If the language model cannot be reached (missing key, quota, or timeout), the agent still writes a structured report from the extracted source sentences. It does not invent citations.

## Usage

```bash
python main.py
```

```text
========================================
   Autonomous Research Agent
========================================

Enter research topic:
> Impact of artificial intelligence on software development

[1/5] Searching the web...
[2/5] Selecting top 3 sources...
[3/5] Extracting article content...
[4/5] Synthesizing research...
[5/5] Generating report...

Research complete!

Report saved to:
reports/20260915_impact-of-artificial-intelligence-on-software.md
```

Non-interactive:

```bash
python main.py --topic "Urban heat islands and green infrastructure" --output reports/research_report.md
```

## Example

Topic: **Impact of artificial intelligence on software development**

The agent searches the open web, ranks results by overlap with the topic (and a small bonus for `.edu` / `.gov` / encyclopedia sources), fetches the top three pages, strips navigation and scripts, and sends the cleaned text to the model. The model is told to use only that material, merge duplicates, and refuse to invent facts. The application then appends the real source URLs — it never trusts the model to invent links.

The saved file follows this shape:

```markdown
# Research Report: <Topic>

## Executive Summary
## Key Findings
## Detailed Analysis
## Conclusion
## Sources
```

## Sample Reports

These were produced by running the agent, not by writing fake citations.

- [Sample report 1 — Impact of AI on software development](reports/sample_report_1.md)
- [Sample report 2 — Urban heat islands and green infrastructure](reports/sample_report_2.md)

## Limitations

- Some websites block automated requests or hide the article behind JavaScript. The agent reports the failure and continues with the remaining sources.
- Search quality depends on the search provider. DuckDuckGo is the default; Wikipedia and OpenAlex are fallbacks when a query returns too few usable hits.
- The report can only be as good as the extracted source text. Thin or promotional pages produce thin reports.
- Dynamic, JavaScript-heavy pages may not yield usable article text.
- PDF results are skipped in favour of HTML articles.
- The language model is instructed not to hallucinate, but it can still over-compress or mis-weight a source. Always open the cited URLs.

## License

MIT. See [LICENSE](LICENSE).
