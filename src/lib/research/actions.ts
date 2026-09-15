import { createServerFn } from "@tanstack/react-start";
import type { ResearchResponse, SearchHit } from "./types";
import { validateTopic } from "./text";

export const searchTopic = createServerFn({ method: "POST" })
  .validator((input: { topic: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true; selected: SearchHit[] } | { ok: false; error: string }> => {
    try {
      const topic = validateTopic(data.topic);
      const { searchWeb } = await import("./search");
      const selected = await searchWeb(topic, 3);
      return { ok: true, selected };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Web search failed." };
    }
  });

export const scrapeSelected = createServerFn({ method: "POST" })
  .validator((input: { selected: SearchHit[] }) => input)
  .handler(async ({ data }) => {
    try {
      const { scrapeSources } = await import("./scraper");
      const sources = await scrapeSources(data.selected);
      const usable = sources.filter((s) => s.content.trim());
      if (usable.length === 0) {
        return {
          ok: false as const,
          error:
            "The selected pages could not be read (timeout, block, or empty content). Try a different topic.",
        };
      }
      return { ok: true as const, sources };
    } catch (err) {
      return { ok: false as const, error: err instanceof Error ? err.message : "Extraction failed." };
    }
  });

export const synthesizeSelected = createServerFn({ method: "POST" })
  .validator((input: { topic: string; sources: import("./types").ScrapedSource[]; selected: SearchHit[] }) => input)
  .handler(async ({ data }): Promise<ResearchResponse> => {
    try {
      const topic = validateTopic(data.topic);
      const { synthesizeReport } = await import("./llm");
      const { buildReport } = await import("./report");
      const usable = data.sources.filter((s) => s.content.trim());
      const draft = await synthesizeReport(topic, usable);
      const reportMarkdown = buildReport(topic, draft, usable);
      const warnings = data.sources.filter((s) => s.error).map((s) => `${s.url} — ${s.error}`);
      return {
        ok: true,
        topic,
        reportMarkdown,
        sources: data.sources,
        selected: data.selected,
        warnings,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Report synthesis failed." };
    }
  });
