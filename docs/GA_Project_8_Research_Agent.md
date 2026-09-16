# BYTE AVIP 2026 — Generative AI Task 8
## Autonomous Research Agent — Progress & Engineering Notes

**Track:** Generative AI  
**Task:** 8 — Autonomous Research Agent  
**Status:** Complete  

---

## What This Project Does

An autonomous research agent that accepts a single topic string, searches the open web across multiple providers, selects the three most relevant sources, fetches and cleans their HTML content, sends the cleaned text to an LLM, and produces a structured Markdown research report with original source URLs appended. The user provides only the topic.

---

## Two Implementations

| Version | Location |
| :--- | :--- |
| Python CLI agent | `GA_8_AutonomousResearchAgent_BYTE/` |
| React/TypeScript web app | `raeBPyktWRQOZXy6-grok-workspace/src/lib/research/` |

Both implement the same research pipeline in their respective languages.

---

## Tech Stack

**Python CLI** (verified from `requirements.txt`):

| Component | Library |
| :--- | :--- |
| Language | Python 3.10+ |
| Web search | `ddgs` (DuckDuckGo), Wikipedia API, OpenAlex API fallbacks |
| Scraping | `requests` + `BeautifulSoup4` |
| LLM | xAI Grok (`grok-4.5`) via OpenAI-compatible REST API |
| Env management | `python-dotenv` |

**Web application** (verified from `package.json`):

| Component | Library / Framework |
| :--- | :--- |
| Language | TypeScript |
| Frontend | React 19 + TanStack Router + TanStack Start |
| Build | Vite 8 |
| Styling | Tailwind CSS v4 |
| Database | PGlite + Kysely |
| LLM | xAI Grok via `api.x.ai/v1` |
| Search | DuckDuckGo API, Wikipedia API, OpenAlex API, Hacker News Algolia API |

---

## Pipeline Architecture

```
User provides topic
    ↓
Topic validation (3–240 chars)
    ↓
Multi-provider web search
  DuckDuckGo → Wikipedia → OpenAlex → Hacker News (cascading fallback)
    ↓
Relevance scoring: 0.55×title_overlap + 0.35×snippet_overlap + domain_bonus
Deduplication + max 2 results per hostname
Top 3 sources selected
    ↓
HTML article extraction (12s timeout per URL)
  Wikipedia: uses Extracts API for clean plain text
  Others: strip nav/header/footer/aside, extract p/h2/h3/li >= 40 chars
  Cap: 9,000 chars per source | Min threshold: 220 chars
    ↓
LLM synthesis (grok-4.5, temperature=0.2, max_tokens=2400)
  OR extractive fallback (no LLM required)
    ↓
Strip any LLM-generated Sources section (regex)
Append application-controlled Sources from actual scraped URLs
    ↓
Structured Markdown report saved / returned
```

---

## Engineering Challenges

### 1. DuckDuckGo instant-answer API returning sparse results

**Problem:** `api.duckduckgo.com/?format=json` frequently returns 0–2 usable hits for topic-specific queries. Designed for instant answers, not general search result listing. No documented minimum result count.

**Solution:**
- Multi-provider cascade in `search.ts` (lines 26–42)
- DuckDuckGo first (up to 10 results)
- If pool < 8: Wikipedia Search API + OpenAlex Works API
- If still < 5: Hacker News Algolia API

**Result:** Sufficient candidate pool to select 3 relevant sources for virtually any substantive topic.

---

### 2. JavaScript-heavy and paywalled sites returning empty article content

**Problem:** Many highly-ranked results render content via JavaScript SPAs or are behind paywalls. Standard `fetch` + HTML parsing returns shell HTML with no article text.

**Solution:**
- Known hard-scrape domains receive score penalty of `-0.35` in ranking (`academia.edu`, `researchgate.net`, `sciencedirect.com`, `ieeexplore.ieee.org`, `link.springer.com`, `jstor.org`, `wiley.com`)
- PDF URLs excluded at candidate filtering
- Sources < 220 usable chars marked `ok: false` and excluded from synthesis
- If all sources fail: descriptive error returned, not an empty report

**Result:** Pipeline degrades gracefully. Failed sources appear in `warnings[]`.

---

### 3. LLM generating a duplicate Sources section

**Problem:** System prompt instructs model not to include a Sources section. Model did so anyway in some cases, producing duplicate sections.

**Solution:**
- `report.ts` applies regex `/\n##\s+Sources\b[\s\S]*$/i` to strip any LLM-generated Sources section
- Application always writes the Sources section itself from actual `ScrapedSource[]` array

**Result:** Source URLs in the final report are always exact, unmodified scraped URLs — never LLM-invented text.

---

## Verified Deliverables

- [x] Multi-provider web search with relevance ranking and deduplication
- [x] HTML article extraction with special handling for Wikipedia
- [x] LLM synthesis (xAI Grok) with no-LLM extractive fallback
- [x] Sentence-level duplicate content deduplication
- [x] Structured Markdown report with verified source URLs
- [x] Warning collection for failed sources
- [x] Sample reports: `GA_8_AutonomousResearchAgent_BYTE/reports/sample_report_1.md`, `sample_report_2.md`

---

## Source Files

**TypeScript web app:**

| File | Purpose |
| :--- | :--- |
| `src/lib/research/search.ts` | Multi-provider web search, ranking, deduplication |
| `src/lib/research/scraper.ts` | HTML article extraction |
| `src/lib/research/llm.ts` | xAI Grok LLM synthesis |
| `src/lib/research/extractive.ts` | No-LLM extractive fallback |
| `src/lib/research/report.ts` | Markdown report assembly |
| `src/lib/research/text.ts` | Text utilities, relevance scoring |
| `src/lib/research/types.ts` | Shared TypeScript types |
| `src/lib/research/actions.ts` | TanStack server function actions |

**Python CLI (`GA_8_AutonomousResearchAgent_BYTE/src/`):**

| File | Purpose |
| :--- | :--- |
| `search.py` | Web search, ranking, selection |
| `scraper.py` | Fetch and extract article content |
| `researcher.py` | Pipeline orchestration |
| `llm.py` | LLM client and research prompt |
| `extractive.py` | Extractive fallback |
| `report.py` | Markdown assembly and file output |
| `utils.py` | URL hygiene, text cleaning |
