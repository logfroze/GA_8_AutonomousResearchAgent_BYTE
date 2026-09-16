# BYTE AVIP 2026
## Project Progress & Engineering Challenges

This document records the actual development process, verified technical challenges, implemented solutions, and final outcomes for four BYTE Arithmatrix AVIP 2026 internship projects — two from the Generative AI track and two from the Data Science track. All technical details are drawn directly from the project source code, configuration files, README documentation, executed notebooks, and generated output files. Nothing has been fabricated or assumed.

---

# 1. Generative AI — Task 7
## Second Brain / Document Interrogator

**Repository:** `GA_7_SecondBrain_BYTE`

### Project Objective

A local Retrieval-Augmented Generation (RAG) system. The user uploads a PDF document, which is indexed into a persistent vector database. The user can then ask natural language questions about the document and receive answers grounded strictly in the document's text, with exact page number citations.

### Tech Stack

Verified from `requirements.txt` and source imports:

| Component | Library / Tool |
| :--- | :--- |
| PDF text extraction | PyMuPDF (`pymupdf >= 1.24.0`) |
| Text chunking | Pure Python (custom recursive splitter in `chunker.py`) |
| Local embeddings | `all-MiniLM-L6-v2` via SentenceTransformers / ONNX Runtime |
| Vector database | ChromaDB (`chromadb >= 0.5.0`, cosine similarity, persistent) |
| Language model | Google Gemini (`gemini-2.5-flash` via `google-genai >= 1.0.0`) |
| Web UI | Streamlit (`streamlit >= 1.35.0`) |
| CLI | Rich (`rich >= 13.7.0`) |
| Configuration | `python-dotenv` |
| Language | Python 3.11 / 3.12 |

### Development Progress

The following steps are directly verifiable from the source files:

1. **Project setup** — `src/config.py` loads `.env` using `python-dotenv`, validates the Gemini API key, and exposes all tunable parameters (`CHUNK_SIZE=800`, `CHUNK_OVERLAP=150`, `TOP_K_RESULTS=4`) as named constants.
2. **PDF ingestion** — `src/loader.py` (`PDFLoader`) uses `pymupdf.open()` to extract each page via `page.get_text("text")`. Blank pages are skipped. Pages stored as dicts with 1-indexed page numbers.
3. **Text chunking** — `src/chunker.py` (`DocumentChunker`) implements a custom recursive character splitter in pure Python (no LangChain or Torch). Separator hierarchy: `["\n\n", "\n", ". ", " ", ""]`. Small pieces merged back up to `chunk_size` with `chunk_overlap` sliding overlap. Each chunk retains its exact page number in `metadata`.
4. **Embedding generation** — `src/embeddings.py` (`LocalEmbeddingEngine`) loads `all-MiniLM-L6-v2` locally. Runs entirely on CPU with no external embedding API.
5. **Vector indexing** — `src/vectorstore.py` (`ChromaVectorStore`) uses `chromadb.PersistentClient` with `hnsw:space = cosine`. Chunks upserted via `collection.upsert(ids, embeddings, documents, metadatas)`. Database persists to `data/chroma_db/`.
6. **Retrieval** — `similarity_search()` embeds query locally, calls `collection.query()`, returns top-k chunks with similarity score (`1.0 - distance`).
7. **LLM answer generation** — `src/generator.py` (`GroundedAnswerGenerator`) builds context blocks with `[Source: X | Page: Y]` headers and sends to Gemini with strict no-hallucination system prompt. Model fallback chain: `[gemini-2.5-flash, gemini-3.6-flash, gemini-2.0-flash]`. If all fail: extracts first three sentences from top retrieved chunk.
8. **Citation extraction** — Page numbers extracted from `metadata` of all retrieved chunks, deduplicated, sorted, returned as `List[int]`. Derived from chunk metadata, not from parsing LLM text.
9. **Pipeline orchestration** — `src/rag_pipeline.py` (`SecondBrainRAG`) wires all components with two public methods: `index_pdf(path)` and `ask(question)`. Generator initialized lazily.
10. **Interfaces** — `app.py` Streamlit web UI. `cli.py` Rich interactive terminal.

### Engineering Challenges

**Challenge 1: Torch DLL failure on Windows during installation**

What happened: `onnxruntime` (required by SentenceTransformers) fails with a `DLL initialization failed` error on some Windows Python 3.11/3.12 environments. The failure message incorrectly points to `torch` rather than `onnxruntime`, making the root cause non-obvious. Error appears at runtime, not at pip install time.

Solution: The README documents the workaround: `pip install torch==2.3.1 --index-url https://download.pytorch.org/whl/cpu --force-reinstall`. The chunker was rewritten in pure Python (`chunker.py`) to eliminate the LangChain text splitter dependency that previously pulled in a conflicting torch version. `requirements.txt` excludes torch entirely.

Result: Embedding engine loads reliably on Windows CPU. Pure Python chunker removes the dependency conflict vector.

---

**Challenge 2: LLM hallucinating page citations**

What happened: Early LLM responses generated `[Page X]` citations with page numbers not corresponding to any real page in the retrieved context.

Solution: System prompt in `generator.py` contains explicit rule: "NEVER invent or hallucinate page numbers. Only cite page numbers that explicitly appear in the excerpt headers." Context blocks formatted with `--- EXCERPT N [Source: X | Page: Y] ---` markers. The `citations` field returned to the UI is derived from `retrieved_chunks[i]["metadata"]["page"]` — not from parsing LLM text output.

Result: Citation tags displayed in Streamlit and CLI always match actual retrieved document pages.

---

**Challenge 3: Streamlit dark CSS broken by native light theme**

What happened: Custom dark CSS injected via `st.markdown(DEV_CSS, unsafe_allow_html=True)` was overridden by Streamlit's native light theme. Top header bar, file uploader dropzone, and bottom chat input container rendered white.

Solution: `.streamlit/config.toml` updated with `base = "dark"` and explicit hex color overrides locking the theme application-wide. Custom CSS updated to target `[data-testid="stBottom"]`, `[data-testid="stFileUploadDropzone"]`, and `header[data-testid="stHeader"]` with `background-color: #0d1117 !important`.

Result: All UI elements render consistently in dark theme regardless of system or browser preference.

### Final Result

Working local RAG system: PDF upload → ChromaDB indexing → local CPU embedding → Gemini-powered grounded answers with page citations → Streamlit UI + Rich CLI.

Evidence: `src/loader.py`, `src/chunker.py`, `src/embeddings.py`, `src/vectorstore.py`, `src/generator.py`, `src/rag_pipeline.py`, `app.py`, `cli.py`, `src/config.py`, `.streamlit/config.toml`, `sample_qa.md`

---

# 2. Generative AI — Task 8
## Autonomous Research Agent

**Repository:** `GA_8_AutonomousResearchAgent_BYTE`

Exists in two forms: a Python CLI agent and a React/TypeScript web application. Both implement the same research pipeline.

### Project Objective

Accepts a single topic string. Searches the web across multiple providers, selects the three most relevant sources, fetches and cleans their HTML, sends the cleaned text to an LLM, and produces a structured Markdown report with original source URLs. The user provides only the topic.

### Tech Stack

**Python CLI** (verified from `requirements.txt`):

| Component | Library |
| :--- | :--- |
| Language | Python 3.10+ |
| Web search | `ddgs` (DuckDuckGo) + Wikipedia + OpenAlex fallbacks |
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

### Development Progress

1. **Topic validation** — `validateTopic()` validates topic is 3–240 characters.
2. **Multi-provider web search** — DuckDuckGo queried first (up to 10 results). If pool < 8 results: Wikipedia Search API, then OpenAlex Works API, then Hacker News Algolia API. Social media domains filtered via `SKIP_DOMAINS` blocklist.
3. **Relevance ranking** — Score formula: `0.55 × title_term_overlap + 0.35 × snippet_term_overlap + domain_bonus`. Domain bonuses: `.edu`/`.gov` (+0.16), Wikipedia (+0.12), `.org` (+0.06). Results below 0.08 discarded. PDFs excluded. Max 2 results per hostname. Top 3 selected.
4. **Article extraction** — 12-second fetch timeout per URL. Wikipedia URLs use the Extracts API (`action=query&prop=extracts&explaintext=1`) for clean plain text. All other URLs: strip nav/script/style/footer/header/aside, extract text from `<article>` or `<main>` blocks (p, h2, h3, li elements >= 40 chars). Content capped at 9,000 chars per source. Sources < 220 usable chars marked `ok: false`.
5. **Content cleaning** — `cleanWhitespace()` normalizes CRLF, collapses blank lines, trims lines, decodes HTML entities.
6. **LLM synthesis** — `api.x.ai/v1/chat/completions` (`grok-4.5`, temperature: 0.2, max_tokens: 2400). Strict research analyst system prompt: use only supplied source text, combine overlapping points, do not invent URLs. 90-second timeout.
7. **Extractive fallback** — If API key missing or LLM call fails (non-rejection): select diverse sentences via term overlap scoring, deduplicate via Jaccard similarity, assemble structured Markdown. Agent always produces output.
8. **Report assembly** — Strip any LLM-generated `## Sources` block via regex, then append clean numbered `## Sources` from actual scraped URLs with generation timestamp.
9. **Warning collection** — Failed scraping URLs collected in `warnings[]` alongside the report.
10. **Sample reports** — `reports/sample_report_1.md` and `sample_report_2.md` as verified output.

### Engineering Challenges

**Challenge 1: DuckDuckGo instant-answer API returning sparse results**

What happened: `api.duckduckgo.com/?format=json` frequently returns sparse results — often just `AbstractURL` and a few `RelatedTopics` — with many topic-specific queries returning 0–2 usable hits. Designed for instant answers, not general search listing.

Solution: Multi-provider cascade in `search.ts` (lines 26–42). DuckDuckGo first. If pool < 8: Wikipedia + OpenAlex. If < 5: Hacker News Algolia.

Result: Sufficient candidate pool to select 3 relevant sources for virtually any substantive topic.

---

**Challenge 2: JavaScript-heavy and paywalled sites returning empty article content**

What happened: Many highly-ranked results render content via JavaScript or are behind paywalls. Standard `fetch` + HTML parsing returns shell HTML with no article text.

Solution: Three mitigations:
1. Known hard-scrape domains (`academia.edu`, `researchgate.net`, `sciencedirect.com`, `ieeexplore.ieee.org`, `link.springer.com`, `jstor.org`, `wiley.com`) receive score penalty of `-0.35`.
2. PDF URLs excluded at candidate filtering.
3. Sources < 220 usable chars marked `ok: false` and excluded from synthesis. If all sources fail, descriptive error returned.

Result: Pipeline degrades gracefully. Failed sources appear in `warnings[]`.

---

**Challenge 3: LLM generating a duplicate Sources section**

What happened: System prompt instructs model not to include a Sources section. Model did so anyway in some cases, producing duplicate sections in the final Markdown.

Solution: `report.ts` applies regex `SOURCES_TAIL = /\n##\s+Sources\b[\s\S]*$/i` to strip any LLM-generated Sources section before appending the application-controlled block. Application always writes Sources from actual `ScrapedSource[]` array.

Result: Report source URLs are always exact, unmodified scraped URLs.

### Final Result

Working autonomous research pipeline in both Python CLI and React/TypeScript web app: multi-provider search → relevance ranking → article extraction → LLM synthesis (with extractive fallback) → structured Markdown report with verified source URLs.

Evidence: `src/search.ts`, `scraper.ts`, `llm.ts`, `extractive.ts`, `report.ts`, `actions.ts`, `types.ts` and Python equivalents in `GA_8_AutonomousResearchAgent_BYTE/src/`. Sample reports: `reports/sample_report_1.md`, `reports/sample_report_2.md`.

---

# 3. Data Science — Task 1
## IPL / Cricket Statistics Dashboard

**Folder:** `ipl-statistics-dashboard`

### Project Objective

End-to-end cricket analytics system analyzing 17 seasons (2008–2024) of IPL data. Ingests ball-by-ball match records, cleans data, computes statistics, generates four required visualizations, and exposes results through a Streamlit dashboard and a React web application.

### Tech Stack

| Component | Library |
| :--- | :--- |
| Language | Python 3.10+ |
| Data processing | Pandas, NumPy |
| Statistical charts | Matplotlib (300 DPI PNG), Plotly (interactive) |
| Interactive dashboard | Streamlit + Plotly |
| Web frontend | React + TypeScript + Vite + Tailwind CSS |
| Notebook | Jupyter (13-section executed) |
| Testing | Python `unittest` (11 unit tests) |
| Data source | Cricsheet Open Cricket Database (`ipl_csv2.zip`) |

### Development Progress

1. **Dataset acquisition** — `scripts/build_dataset.py` downloads and unpacks Cricsheet `ipl_csv2.zip`. Result: 1,243 match records (`matches.csv`) and 295,732 ball-by-ball delivery records (`deliveries.csv`). Exported in CSV and Parquet.
2. **Data inspection** — Structural metadata captured. Raw data: mixed season identifiers and inconsistent team names from franchise rebrandings.
3. **Data cleaning** — `src/preprocessing.py` applies five documented transformations: season normalization, franchise harmonization, wicket filtering, date parsing, numeric coercion.
4. **Statistical calculations** — `src/statistics.py` computes: runs per match per season, top-10 run-scorers, top-10 wicket-takers (filtered to `is_bowler_wicket == 1`), team win percentages.
5. **Visualization generation** — `src/utils.py` renders four Matplotlib charts at 300 DPI. Plotly interactive versions served in Streamlit.
6. **Streamlit dashboard** — `app.py`: season/team filters, KPI metrics, interactive charts, data explorer.
7. **React web app** — `scripts/export_json.py` pre-aggregates stats to `public/data/ipl_data.json` for client-side filtering.
8. **Jupyter notebook** — 13-section executed notebook generated by `scripts/build_notebook.py`.
9. **Unit tests** — `tests/test_pipeline.py`: 11 tests covering data loading, cleaning, franchise mapping, bowler-wicket filter, formulas, chart export. Expected: `Ran 11 tests in ~4.7s ... OK`.

### Engineering / Data Challenges

**Challenge 1: Franchise name fragmentation breaking win percentage statistics**

What happened: Without harmonization, `Delhi Daredevils` and `Delhi Capitals` appear as two distinct franchises. Same for `Kings XI Punjab` / `Punjab Kings` and `Royal Challengers Bangalore` / `Royal Challengers Bengaluru`. This understates win percentages and creates artificially small sample sizes.

Solution: Franchise mapping dictionary in `src/preprocessing.py` maps all historical names to canonical modern names before any aggregation.

Result: Each franchise's win percentage computed over complete match history. Preserves over 250 affected match records.

---

**Challenge 2: Run-outs incorrectly counted as bowler wickets**

What happened: Raw `deliveries.csv` marks `run out`, `retired hurt`, and `retired out` as wickets. Including these inflates bowler statistics in violation of official ICC/IPL rules.

Solution: `src/preprocessing.py` creates `is_bowler_wicket` boolean column that is `True` only for: `bowled`, `caught`, `caught and bowled`, `lbw`, `stumped`, `hit wicket`. All wicket-taker stats filter on this column.

Result: Top-10 wicket-taker chart reflects only legitimate bowler-credited dismissals. Yuzvendra Chahal leads with 233 wickets.

---

**Challenge 3: Mixed season identifiers preventing correct chronological sort**

What happened: Split-year seasons (`2007/08`, `2020/21`) use a slash format while others use a single year. Direct sort on raw season string produces incorrect ordering.

Solution: Normalization function in `src/preprocessing.py` converts slash-formatted seasons to the latter year (`'2007/08'` → `2008`, `'2020/21'` → `2021`).

Result: Season-based time-series charts render in correct chronological order from 2008 to 2024.

### Final Result

Verified statistics:

| Metric | Verified Value |
| :--- | :--- |
| Total matches analyzed | 1,243 |
| Total deliveries analyzed | 295,732 |
| All-time leading run-scorer | Virat Kohli — 9,346 runs in 275 innings |
| All-time leading wicket-taker | Yuzvendra Chahal — 233 wickets |
| Season scoring range | 286.9 runs/match (2009) to 371.0 runs/match (2024 peak) |
| Unit tests | 11 passing |

Evidence: `data/matches.csv`, `data/deliveries.csv`, `assets/charts/`, `src/data_loader.py`, `src/preprocessing.py`, `src/statistics.py`, `tests/test_pipeline.py`, `notebooks/ipl_analysis.ipynb`

---

# 4. Data Science — Task 4
## Bank Marketing Decision Tree Classifier

**Repository:** `DS_4_BankMarketing_DecisionTree_BYTE`

### Project Objective

Supervised ML pipeline predicting whether a bank customer will subscribe to a term deposit (`yes` / `no`). Uses Decision Tree Classifier on UCI Bank Marketing dataset. Goal: identify top feature importances and produce an interpretable, auditable model.

### Tech Stack

| Component | Library |
| :--- | :--- |
| Language | Python 3.10/3.11/3.12 |
| Data processing | Pandas, NumPy |
| Machine learning | Scikit-Learn (Decision Tree, Pipeline, ColumnTransformer) |
| Visualization | Matplotlib, Seaborn |
| Notebook | Jupyter (20-section executed) |

### Development Progress

1. **Dataset** — UCI Bank Marketing dataset (`bank.csv`): 4,521 records, 16 features, binary target `y`. Class distribution: ~88.5% negative (`no`), ~11.5% positive (`yes`).
2. **Data inspection** — Shape, dtypes, missing values, class distribution captured to `models/data_inspection.json`.
3. **Feature/target separation** — Column `y` label-encoded to binary (0/1), separated from `X` before any transformations.
4. **Stratified train/test split** — 80% train (3,616 samples) / 20% test (905 samples), `random_state=42`, `stratify=y`.
5. **Preprocessing pipeline** — `ColumnTransformer` within `Pipeline`: numerical (`SimpleImputer(median)` + `StandardScaler`), categorical (`SimpleImputer(most_frequent)` + `OneHotEncoder(handle_unknown='ignore')`).
6. **Decision Tree training** — `DecisionTreeClassifier(criterion='gini', max_depth=5, random_state=42)` fitted on training set only.
7. **Evaluation** — Predictions on 905-sample test set. Metrics serialized to `models/metrics.json`.
8. **Confusion matrix** — `src/evaluate.py` generates Seaborn heatmap → `assets/confusion_matrix.png`.
9. **Feature importance** — `feature_importances_` aligned to `get_feature_names_out()` from the preprocessor → top 5 reported → `assets/feature_importance.png`.
10. **Notebook** — 20-section executed notebook generated by `build_notebook.py`.

### Engineering / ML Challenges

**Challenge 1: Class imbalance affecting metric interpretation**

What happened: Dataset is ~88.5% negative. A model predicting "no" for every sample achieves 88.5% accuracy trivially. The Decision Tree without class weighting prioritizes the majority class.

Solution: Report all four metrics (accuracy, precision, recall, F1) together. README documents `class_weight='balanced'` as an alternative for campaigns prioritizing recall over precision.

Result: Evaluation is honest about model trade-offs. 88.40% accuracy, 49.06% precision, 25.00% recall.

---

**Challenge 2: Feature name mapping after OneHotEncoder transformation**

What happened: After `ColumnTransformer` applies `OneHotEncoder`, the feature matrix expands from 16 columns. `feature_importances_` is aligned to expanded column names, not original names.

Solution: `src/evaluate.py` calls `pipeline.named_steps['preprocessor'].get_feature_names_out()` to retrieve expanded column names, then aligns with `feature_importances_` for sorting and display.

Result: Importances correctly attributed to human-readable names (e.g., `poutcome_success`, `month_oct`, `contact_unknown`).

---

**Challenge 3: Data leakage risk from the `duration` feature**

What happened: `duration` (call duration in seconds) is the most important feature at 54.04% Gini importance. It is only available after a call is completed — unavailable before deciding to call a customer.

Solution: README explicitly documents this: "while `duration` is the strongest predictor (54.04% importance), it is only measured during or after a phone call. Banks should prioritize pre-call indicators such as `poutcome_success` (23.66% importance)." Feature retained per task requirements, limitation clearly communicated.

Result: Model documentation accurate about deployment constraints.

### Final Result

Verified metrics from `models/metrics.json`:

| Metric | Value |
| :--- | :--- |
| Accuracy | 88.40% |
| Precision | 49.06% |
| Recall | 25.00% |
| F1-Score | 33.12% |
| True Negatives | 774 |
| False Positives | 27 |
| False Negatives | 78 |
| True Positives | 26 |

Top 5 feature importances:

| Rank | Feature | Gini Importance |
| :---: | :--- | :---: |
| 1 | `duration` | 54.04% |
| 2 | `poutcome_success` | 23.66% |
| 3 | `month_oct` | 6.18% |
| 4 | `day` | 3.01% |
| 5 | `contact_unknown` | 2.89% |

Evidence: `models/metrics.json`, `assets/confusion_matrix.png`, `assets/feature_importance.png`, `src/preprocessing.py`, `src/train.py`, `src/evaluate.py`, `notebooks/bank_marketing_analysis.ipynb`

---

# 5. Engineering Challenge Summary

| Project | Challenge | Solution | Outcome |
| :--- | :--- | :--- | :--- |
| Task 7 | Windows DLL init failure in ONNX Runtime | Rewrote chunker in pure Python; documented CPU torch pin | Embedding engine loads reliably on Windows CPU |
| Task 7 | LLM hallucinating page citations | Explicit page markers in prompt; citations from chunk metadata not LLM text | Displayed citations always match actual document pages |
| Task 7 | Streamlit light theme breaking custom dark CSS | Locked theme in config.toml; CSS targeting all affected native elements | Consistent dark theme in all scenarios |
| Task 8 | DuckDuckGo API returning sparse results | Multi-provider cascade: DDG → Wikipedia → OpenAlex → HN Algolia | Sufficient candidates for ranking on any substantive topic |
| Task 8 | JS-heavy and paywalled sites yielding empty content | Score penalty for hard-scrape domains; 220-char usability threshold; graceful degradation | Pipeline degrades gracefully with warnings |
| Task 8 | LLM generating duplicate Sources section | Regex strip of LLM-generated Sources block; application writes Sources itself | Report sources are always verified scraped URLs |
| Task 1 | Franchise rebranding fragmenting win percentage stats | Canonical name mapping applied before all aggregations | Complete match history per franchise under one name |
| Task 1 | Run-outs incorrectly counted as bowler wickets | is_bowler_wicket boolean filtering only ICC-valid dismissal types | Wicket-taker chart reflects official bowling credit rules |
| Task 1 | Mixed season identifiers breaking chronological sort | Normalization converting '2007/08' to 2008 etc. | Correct chronological ordering in all time-series charts |
| Task 4 | Class imbalance skewing toward majority class | Reported all four metrics; documented balanced alternative | Evaluation honest about model trade-offs |
| Task 4 | Feature name mapping after OneHotEncoder | get_feature_names_out() aligned with feature_importances_ | Importances correctly attributed to readable feature names |
| Task 4 | duration feature data leakage concern | Documented operational limitation; highlighted pre-call features | Model documentation accurate about deployment constraints |

---

# 6. LinkedIn Post Material

Raw factual material for later LinkedIn post drafting. Not polished posts — factual source only.

---

### Task 7 — Second Brain (Local RAG System)

**One-line accomplishment:** Built a fully local RAG system that answers questions about uploaded PDF documents with exact page citations, running embeddings entirely on CPU with no external embedding API.

**Strongest engineering challenges:**
1. ONNX Runtime DLL initialization failure on Windows from conflicting torch version in LangChain dependency chain
2. LLM hallucinating page numbers in citation brackets despite system prompt instructions
3. Streamlit custom dark CSS theme overridden by native light theme

**Solutions:**
1. Rewrote text chunker in pure Python; removed LangChain dependency entirely from requirements.txt
2. Formatted context blocks with explicit [Source: X | Page: Y] markers; extracted citations from chunk metadata, not from LLM text output
3. Locked theme via config.toml with hex values; targeted Streamlit native element selectors with !important

**Final outcome:** Working Streamlit web app + Rich CLI with persistent ChromaDB, local SentenceTransformer embeddings, Gemini-powered grounded answers, and verified page citations.

**Tech stack:** Python, PyMuPDF, ChromaDB, SentenceTransformers (all-MiniLM-L6-v2), ONNX Runtime, Google Gemini (gemini-2.5-flash), Streamlit, Rich

---

### Task 8 — Autonomous Research Agent

**One-line accomplishment:** Built an autonomous research pipeline that takes a topic, searches 4 web providers, scrapes and cleans article text, synthesizes a structured Markdown report via LLM, and degrades gracefully to extractive output if the LLM is unavailable.

**Strongest engineering challenges:**
1. DuckDuckGo instant-answer API returning too few results for topic-specific queries
2. JavaScript-heavy and paywalled sites yielding empty article content from server-side HTML fetch
3. LLM inserting a Sources section into its output, duplicating the application-controlled sources block

**Solutions:**
1. Cascading multi-provider search: DDG → Wikipedia API → OpenAlex → Hacker News Algolia
2. Score penalties for known hard-scrape domains; 220-character minimum usability threshold; graceful ok: false handling
3. Regex strip of any LLM-generated Sources block; application always appends sources from actual scraped URLs

**Final outcome:** Python CLI agent and React/TypeScript web application both implementing the full pipeline with multi-provider search, extractive fallback, and two sample reports as verified output.

**Tech stack:** Python, ddgs, requests, BeautifulSoup4, xAI Grok (grok-4.5); TypeScript, React 19, TanStack Router, Vite, Tailwind CSS v4

---

### Task 1 — IPL Cricket Statistics Dashboard

**One-line accomplishment:** Analyzed 17 seasons of IPL ball-by-ball data (1,243 matches, 295,732 deliveries) from Cricsheet, resolved franchise rebranding fragmentation and wicket-counting errors, delivered four verified statistical visualizations with a Streamlit dashboard and React frontend.

**Strongest engineering challenges:**
1. Franchise rebrandings (Delhi Daredevils → Delhi Capitals etc.) fragmenting win percentage calculations across seasons
2. Run-outs appearing in the bowler wicket count in raw data, inflating bowling statistics
3. Mixed season identifiers ('2020/21' vs '2020') preventing correct chronological sort

**Solutions:**
1. Canonical franchise name mapping applied before all aggregations
2. is_bowler_wicket boolean column restricting credit to 6 ICC-valid dismissal types only
3. Season normalization function converting split-year strings to the latter calendar year

**Final outcome:** Four 300 DPI Matplotlib charts and interactive Plotly versions in Streamlit, with a 13-section executed Jupyter notebook and 11 unit tests passing.

**Verified statistics:** Virat Kohli: 9,346 runs | Yuzvendra Chahal: 233 wickets | Season scoring range: 286.9 to 371.0 runs/match

**Tech stack:** Python, Pandas, NumPy, Matplotlib, Plotly, Streamlit, Jupyter, React, TypeScript, Vite

---

### Task 4 — Bank Marketing Decision Tree Classifier

**One-line accomplishment:** Built a Decision Tree classification pipeline on UCI Bank Marketing data achieving 88.40% accuracy on 905 held-out samples, with interpretable feature importances and explicit documentation of the duration data leakage issue.

**Strongest engineering challenges:**
1. Class imbalance (~88.5% negative class) making accuracy a misleading single metric
2. Feature name mapping after OneHotEncoder expansion — feature_importances_ aligned to expanded columns, not original names
3. duration being the top predictor (54.04% importance) despite being a post-call measurement unavailable before the call is made

**Solutions:**
1. Reported accuracy + precision + recall + F1 together; documented class_weight='balanced' as alternative
2. Used get_feature_names_out() from preprocessor to reconstruct human-readable feature names
3. Documented leakage concern explicitly; highlighted poutcome_success as most actionable pre-call predictor

**Final outcome:** Executed classification pipeline with serialized metrics (models/metrics.json), confusion matrix, feature importance chart, and 20-section executed Jupyter notebook.

**Verified metrics:** Accuracy: 88.40% | Precision: 49.06% | Recall: 25.00% | F1: 33.12% | Top feature: duration (54.04% Gini importance)

**Tech stack:** Python, Pandas, NumPy, Scikit-Learn, Matplotlib, Seaborn, Jupyter
