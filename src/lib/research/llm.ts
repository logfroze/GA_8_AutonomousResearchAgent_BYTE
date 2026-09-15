import type { ScrapedSource } from "./types";
import { extractiveReport } from "./extractive";

const DEFAULT_MODEL = "grok-4.5";
const MAX_TOKENS = 2400;

const SYSTEM_PROMPT = `You are a careful research analyst.

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
- Do not invent URLs.`;

export async function synthesizeReport(topic: string, sources: ScrapedSource[]): Promise<string> {
  const usable = sources.filter((s) => s.content.trim());
  if (usable.length === 0) {
    throw new Error("None of the selected pages produced usable text, so a report could not be written.");
  }

  const apiKey = process.env.XAI_API_KEY || process.env.LLM_API_KEY;
  if (!apiKey) return extractiveReport(topic, usable);

  try {
    return await callLlm(topic, usable, apiKey);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("rejected")) throw err;
    return extractiveReport(topic, usable);
  }
}

async function callLlm(topic: string, sources: ScrapedSource[], apiKey: string): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.LLM_MODEL || DEFAULT_MODEL,
      temperature: 0.2,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(topic, sources) },
      ],
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (res.status === 401) {
    throw new Error("The language model API key was rejected.");
  }
  if (!res.ok) {
    const detail = await safeError(res);
    throw new Error(`LLM API error (${res.status}): ${detail}`);
  }

  const body = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = body.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("The language model returned an empty report.");
  return text;
}

function buildUserPrompt(topic: string, sources: ScrapedSource[]): string {
  const blocks = [`Research topic: ${topic}`, "", "Source material:", ""];
  sources.forEach((source, index) => {
    blocks.push(`----- SOURCE ${index + 1} -----`);
    blocks.push(`Title: ${source.title}`);
    blocks.push(`URL: ${source.url}`);
    blocks.push("");
    blocks.push(source.content);
    blocks.push("");
  });
  blocks.push("Write the research report now. Deduplicate repeated points. Stay within the source material.");
  return blocks.join("\n");
}

async function safeError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: { message?: string } | string };
    if (typeof data.error === "string") return data.error.slice(0, 240);
    if (data.error && typeof data.error === "object") return (data.error.message || "").slice(0, 240);
  } catch {
    /* ignore */
  }
  return "";
}
