# BYTE AVIP 2026 — Generative AI Task 8
## Autonomous Research Agent / Automated Web Researcher

You are my senior Python + Generative AI engineer.

Build this project as a **production-quality internship project** for the **BYTE by Arithmatrix AVIP 2026 Generative AI track**.

The project must follow the Task 8 requirements exactly. Do not add unnecessary features just to make it look complicated.

---

# 1. PROJECT OBJECTIVE

Build an **Autonomous Research Agent** that accepts a research topic from the user and automatically:

1. Searches the web for the topic.
2. Identifies the **3 most relevant articles/results**.
3. Fetches those webpages.
4. Extracts and cleans their useful textual content.
5. Sends the collected information to an LLM.
6. Synthesizes the information into one coherent research report.
7. Removes/reduces duplicate information between sources.
8. Produces a structured **Markdown report**.
9. Includes the original source URLs in the final report.

The user should only need to provide a topic.

Example:

> "Impact of artificial intelligence on software development"

The agent should then perform the research workflow automatically and produce something like:

```text
research_report.md
```

containing a structured report and source links.

---

# 2. REQUIRED TECHNOLOGY STACK

Use this stack unless there is a strong technical reason to change something:

### Language
- Python 3.11 or 3.12

### Web Search
Use one of:
- DuckDuckGo search
- SerpAPI

Prefer **DuckDuckGo** if it can satisfy the requirements without requiring a paid API.

If SerpAPI is used, keep the API key inside `.env`.

### Web Scraping
- `requests`
- `BeautifulSoup4`

Use these to fetch and extract readable article content.

### Generative AI
Use an LLM API through a clean Python abstraction.

The implementation should support an API key through:

```text
.env
```

Never hardcode API keys.

### Supporting Libraries
- `python-dotenv`
- standard Python libraries where possible

Avoid unnecessary frameworks and dependencies.

---

# 3. REQUIRED PROJECT STRUCTURE

Create this structure:

```text
GA_8_AutonomousResearchAgent_BYTE/
│
├── src/
│   ├── __init__.py
│   ├── search.py
│   ├── scraper.py
│   ├── researcher.py
│   ├── llm.py
│   ├── report.py
│   └── utils.py
│
├── reports/
│   ├── sample_report_1.md
│   └── sample_report_2.md
│
├── assets/
│   └── screenshots/
│
├── main.py
├── requirements.txt
├── .env.example
├── .gitignore
├── README.md
└── LICENSE
```

Keep the architecture modular.

Do NOT put the entire application inside one giant Python file.

---

# 4. APPLICATION FLOW

Implement this exact workflow:

```text
User enters research topic
        ↓
Search web
        ↓
Collect search results
        ↓
Rank/select relevant results
        ↓
Select top 3 articles
        ↓
Fetch webpages
        ↓
Extract useful text
        ↓
Clean extracted content
        ↓
Validate usable content
        ↓
Send source information to LLM
        ↓
Synthesize information
        ↓
Remove duplicate/repeated information
        ↓
Generate structured report
        ↓
Save Markdown file
        ↓
Display report location + source URLs
```

---

# 5. SEARCH MODULE

Create:

```text
src/search.py
```

Responsibilities:

- Accept a research topic.
- Perform a web search.
- Collect relevant results.
- Extract:
  - title
  - URL
  - short description/snippet where available
- Select the **top 3 relevant results**.

Do not simply select random results.

Implement basic validation so that:

- URLs are valid.
- Duplicate URLs are removed.
- Empty results are handled gracefully.

The search functionality should be isolated from the rest of the application.

---

# 6. WEB SCRAPER MODULE

Create:

```text
src/scraper.py
```

Responsibilities:

- Download each selected webpage using `requests`.
- Parse HTML using `BeautifulSoup4`.
- Remove unnecessary elements such as:
  - scripts
  - styles
  - navigation
  - obvious page clutter
- Extract the useful readable article text.
- Clean excessive whitespace.
- Return structured source data.

For each source, preserve:

```text
title
url
content
```

Add reasonable request timeouts.

Handle failures gracefully.

For example, if one website cannot be accessed, the program should not crash with an ugly traceback.

Instead, report the failure and continue where possible.

---

# 7. RESEARCH MODULE

Create:

```text
src/researcher.py
```

This module should orchestrate the research process.

It should:

1. Receive the topic.
2. Call the search module.
3. Obtain the top 3 results.
4. Scrape the selected webpages.
5. Validate the extracted content.
6. Prepare the collected information for the LLM.
7. Request a synthesized report.

Keep the orchestration logic clean and readable.

---

# 8. LLM MODULE

Create:

```text
src/llm.py
```

Responsibilities:

- Handle communication with the selected LLM API.
- Keep API-specific logic isolated.
- Read credentials from environment variables.
- Construct a strong research prompt.
- Return the generated report.

The LLM prompt should clearly instruct the model to:

- Use only the supplied source material.
- Combine information from the sources.
- Remove redundant/duplicated points.
- Do not invent unsupported facts.
- Clearly structure the report.
- Maintain factual consistency.
- Identify important findings.
- Include source references.

Do not allow the LLM to silently fabricate information that wasn't present in the collected sources.

---

# 9. REPORT GENERATION

Create:

```text
src/report.py
```

The final report must be saved as Markdown.

Example structure:

```markdown
# Research Report: <Topic>

## Executive Summary

...

## Key Findings

### Finding 1
...

### Finding 2
...

### Finding 3
...

## Detailed Analysis

...

## Conclusion

...

## Sources

1. [Article Title](URL)
2. [Article Title](URL)
3. [Article Title](URL)
```

The exact sections can be adjusted depending on the topic, but the report must remain structured and readable.

The report must contain the original URLs.

Do not invent URLs.

---

# 10. MAIN CLI

Create:

```text
main.py
```

The user should be able to run:

```bash
python main.py
```

Then see something similar to:

```text
========================================
   Autonomous Research Agent
========================================

Enter research topic:
>
```

After entering the topic, show clear progress such as:

```text
[1/5] Searching the web...
[2/5] Selecting top 3 sources...
[3/5] Extracting article content...
[4/5] Synthesizing research...
[5/5] Generating report...

Research complete!

Report saved to:
reports/research_report.md
```

Keep the CLI simple and professional.

No unnecessary GUI unless it materially improves the project.

---

# 11. ERROR HANDLING

Implement practical error handling for:

- Empty topic
- Search failure
- No search results
- Invalid URLs
- Website timeout
- Website blocking requests
- Empty webpage content
- LLM API failure
- Missing API key
- File-writing failure

The program should provide understandable messages rather than raw confusing exceptions whenever possible.

---

# 12. SECURITY

Never hardcode credentials.

Use:

```text
.env
```

Example:

```text
LLM_API_KEY=your_api_key_here
SEARCH_API_KEY=your_api_key_here
```

Provide:

```text
.env.example
```

with placeholder values.

Add `.env` to `.gitignore`.

Make absolutely sure no real API key appears anywhere in:

- source code
- README
- screenshots
- sample reports
- Git history

---

# 13. SAMPLE REPORTS

The BYTE requirement asks for **at least 2 sample reports**.

Create:

```text
reports/sample_report_1.md
reports/sample_report_2.md
```

Use two different research topics.

The reports must be generated through the actual application workflow.

Do NOT fabricate fake results just to satisfy the requirement.

Clearly identify the topics and include the actual source URLs used.

---

# 14. README

Create a professional but straightforward `README.md`.

Include:

## Project Overview

Explain what the Autonomous Research Agent does.

## Features

Mention:

- Web search
- Top 3 source selection
- Webpage extraction
- Content cleaning
- LLM-powered synthesis
- Duplicate information reduction
- Markdown report generation
- Source URL preservation

## Tech Stack

List the actual technologies used.

## Project Structure

Explain the important files/directories.

## Installation

Example:

```bash
git clone <repository-url>
cd GA_8_AutonomousResearchAgent_BYTE

python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt
```

Also provide Linux/macOS activation if appropriate.

## Environment Variables

Explain `.env` setup without exposing real credentials.

## Usage

Show:

```bash
python main.py
```

and explain the workflow.

## Example

Provide an example research topic and explain the resulting report.

## Sample Reports

Link to the two sample reports.

## Limitations

Honestly mention limitations such as:

- Some websites may block automated requests.
- Search quality depends on the search provider.
- LLM output depends on the quality of extracted source content.
- Dynamic JavaScript-heavy pages may not be fully extractable.

Do not pretend the system is perfect.

---

# 15. REQUIREMENTS.TXT

Generate a clean `requirements.txt` containing only packages actually used.

For example, depending on the final implementation:

```text
requests
beautifulsoup4
python-dotenv
```

plus the selected LLM/search SDK packages if actually required.

Do NOT dump unnecessary packages into requirements.txt.

---

# 16. GITHUB QUALITY

The repository must be ready for a public GitHub submission.

Include:

- `README.md`
- `requirements.txt`
- `.gitignore`
- `.env.example`
- `LICENSE`
- clean source code
- sample reports
- screenshots

Do not include:

- `.env`
- API keys
- virtual environment
- cache files
- unnecessary generated files
- debugging leftovers

Use meaningful commit-ready organization.

---

# 17. UI / DESIGN STYLE

If you create any interface beyond the CLI, keep it:

- Simple
- Clean
- Professional
- Practical
- Human-made

IMPORTANT:

Do NOT use:

- glassmorphism
- excessive gradients
- glowing cards
- huge shadows
- excessive animations
- futuristic AI dashboard aesthetics
- generic "AI-generated" visual design

This should look like a developer actually built it for an internship project.

Functionality and clarity are more important than visual effects.

---

# 18. CODE QUALITY

Write code as a professional Python developer would.

Requirements:

- Clear function names
- Clear variable names
- Small reusable functions
- Useful comments only where necessary
- Type hints where helpful
- Proper exception handling
- No giant functions
- No duplicated logic
- No unnecessary abstractions
- No dead code
- No hardcoded credentials
- No fake data
- No fake metrics
- No fake source URLs

Keep it understandable enough that I can explain every part during an internship evaluation.

---

# 19. TESTING

Actually run the project.

Test at least:

### Test 1
A normal research topic.

### Test 2
Another unrelated research topic.

### Test 3
Empty input.

### Test 4
A topic that produces poor/no search results.

### Test 5
At least one webpage scraping failure if practical.

Verify that the application handles these cases properly.

Fix all errors before considering the project complete.

---

# 20. BYTE REQUIREMENT CHECK

Before finishing, explicitly verify that the implementation satisfies:

- [ ] User can enter a topic string.
- [ ] Web search is performed.
- [ ] Top 3 relevant articles/results are selected.
- [ ] Raw webpage text is extracted.
- [ ] Extracted content is cleaned.
- [ ] LLM synthesizes the collected information.
- [ ] Duplicate information is reduced.
- [ ] Structured research report is generated.
- [ ] Report is saved as Markdown.
- [ ] Source URLs are included.
- [ ] Public GitHub-ready repository structure exists.
- [ ] README contains setup instructions.
- [ ] API key configuration is documented.
- [ ] Main agent script exists.
- [ ] At least 2 sample reports exist.
- [ ] Screenshots are included.
- [ ] No secrets are committed.

If anything is missing, implement it before stopping.

---

# 21. FINAL PRODUCTION CHECK

After implementation:

1. Run the application.
2. Test the complete workflow.
3. Inspect generated reports.
4. Verify all 3 source URLs.
5. Check that the report is actually based on scraped content.
6. Verify error handling.
7. Verify `.env` is ignored.
8. Verify README instructions work from a fresh environment.
9. Verify `requirements.txt` is sufficient.
10. Check the repository structure against the BYTE requirements.
11. Fix any remaining issues.

Do NOT tell me the project is complete merely because the code was written.

It is complete only after it has actually been run and verified.

---

# IMPORTANT DEVELOPMENT PRINCIPLES

Build the **actual internship task**, not an unnecessarily complicated AI framework.

The goal is:

**Topic → Search → Top 3 Articles → Scrape → Clean → LLM Synthesis → Markdown Report + Sources**

Keep the implementation reliable, understandable, reproducible, and genuinely useful.

Make it look like a strong **human-engineered Python Generative AI project**, not something overloaded with unnecessary AI buzzwords or features.