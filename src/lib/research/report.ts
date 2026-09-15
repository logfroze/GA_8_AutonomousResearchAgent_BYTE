import type { ScrapedSource } from "./types";

const SOURCES_TAIL = /\n##\s+Sources\b[\s\S]*$/i;

export function buildReport(topic: string, llmMarkdown: string, sources: ScrapedSource[]): string {
  let body = llmMarkdown.trim().replace(SOURCES_TAIL, "").trim();
  if (!body.toLowerCase().startsWith("# research report")) {
    body = `# Research Report: ${topic}\n\n${body}`;
  }

  const generated = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const lines = ["## Sources", ""];
  sources.forEach((source, index) => {
    const title = source.title.replaceAll("[", "(").replaceAll("]", ")");
    lines.push(`${index + 1}. [${title}](${source.url})`);
  });
  lines.push("");
  lines.push(`_Generated ${generated} by the Autonomous Research Agent._`);
  return `${body}\n\n${lines.join("\n")}\n`;
}
