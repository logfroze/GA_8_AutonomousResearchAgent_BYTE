import type { ScrapedSource } from "./types";
import { tokenize } from "./text";

export function extractiveReport(topic: string, sources: ScrapedSource[]): string {
  const bundles = sources.filter((s) => s.content.trim()).map(sourceSentences);
  const all: Array<[string, string]> = [];
  for (const bundle of bundles) {
    for (const sentence of bundle.sentences) all.push([sentence, bundle.title]);
  }
  const selected = selectDiverse(topic, all, 18);
  const summary = joinUnique(selected.slice(0, 4));
  const findings = selected.length > 6 ? selected.slice(1, 7) : selected.slice(0, 5);

  const parts: string[] = [
    `# Research Report: ${topic}`,
    "",
    "## Executive Summary",
    "",
    summary || "The selected sources did not contain enough overlapping, usable prose to summarise.",
    "",
    "## Key Findings",
    "",
  ];

  findings.forEach(([sentence, title], i) => {
    parts.push(`### Finding ${i + 1}`, "", `${sentence} _(Source: ${title})_`, "");
  });

  parts.push(
    "## Detailed Analysis",
    "",
    "The notes below stay close to the extracted source text. Repeated claims across pages were dropped so each point appears once.",
    "",
  );

  const used = new Set(findings.map(([s]) => s));
  for (const bundle of bundles) {
    const leftover = dedupeList(bundle.sentences.filter((s) => !used.has(s))).slice(0, 6);
    if (!leftover.length) continue;
    parts.push(`### ${bundle.title}`, "", leftover.join(" "), "");
    leftover.forEach((s) => used.add(s));
  }

  const conclusionPool = selected.length >= 3 ? selected.slice(-3) : selected;
  const conclusion =
    joinUnique(conclusionPool) ||
    `Across the collected sources, the material on “${topic}” is limited to the pages listed below.`;
  parts.push("## Conclusion", "", conclusion, "");
  return `${parts.join("\n").trim()}\n`;
}

function sourceSentences(source: ScrapedSource): { title: string; sentences: string[] } {
  const text = source.content.replace(/^\(Full page could not be extracted:[^)]+\)\s*/, "").replace(/\n/g, " ");
  const raw = text.split(/(?<=[.!?])\s+(?=[A-Z“"])/);
  const sentences = raw
    .map((piece) => piece.replace(/\s+/g, " ").trim())
    .filter((piece) => piece.length >= 60 && piece.length <= 320 && !piece.startsWith("http"));
  return { title: source.title, sentences: sentences.slice(0, 40) };
}

function selectDiverse(topic: string, items: Array<[string, string]>, k: number): Array<[string, string]> {
  const terms = tokenize(topic);
  const scored = items
    .map(([sentence, title]) => {
      const tokens = tokenize(sentence);
      const overlap = tokens.size ? [...terms].filter((t) => tokens.has(t)).length / Math.max(terms.size, 1) : 0;
      const density = Math.min(sentence.length / 180, 1);
      return { score: 0.7 * overlap + 0.3 * density, sentence, title };
    })
    .sort((a, b) => b.score - a.score);

  const picked: Array<[string, string]> = [];
  for (const item of scored) {
    if (picked.some(([existing]) => tooSimilar(item.sentence, existing))) continue;
    picked.push([item.sentence, item.title]);
    if (picked.length >= k) break;
  }
  return picked;
}

function tooSimilar(a: string, b: string, threshold = 0.55): boolean {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (!ta.size || !tb.size) return false;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / (ta.size + tb.size - inter) >= threshold;
}

function dedupeList(sentences: string[]): string[] {
  const kept: string[] = [];
  for (const sentence of sentences) {
    if (kept.some((existing) => tooSimilar(sentence, existing))) continue;
    kept.push(sentence);
  }
  return kept;
}

function joinUnique(items: Array<[string, string]>): string {
  const kept: Array<[string, string]> = [];
  for (const item of items) {
    if (kept.some(([existing]) => tooSimilar(item[0], existing))) continue;
    kept.push(item);
  }
  return kept.map(([s]) => s).join(" ");
}
