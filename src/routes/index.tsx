import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { ReportView } from "@/components/report-view";
import { searchTopic, scrapeSelected, synthesizeSelected } from "@/lib/research/actions";
import type { ResearchOk, SearchHit, ScrapedSource } from "@/lib/research/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Desk });

const EXAMPLES = [
  "Impact of artificial intelligence on software development",
  "Urban heat islands and green infrastructure",
  "CRISPR gene editing ethics and regulation",
];

const STEPS = [
  "Searching the web",
  "Selecting top 3 sources",
  "Extracting article content",
  "Synthesizing research",
  "Generating report",
];

type Phase = "idle" | "running" | "done" | "error";

function Desk() {
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<SearchHit[]>([]);
  const [result, setResult] = useState<ResearchOk | null>(null);

  const canRun = topic.trim().length >= 3 && phase !== "running";

  async function run(nextTopic?: string) {
    const query = (nextTopic ?? topic).trim();
    setTopic(query);
    setError("");
    setResult(null);
    setSelected([]);
    setPhase("running");
    setStep(1);
    try {
      const found = await searchTopic({ data: { topic: query } });
      if (!found.ok) throw new Error(found.error);
      setSelected(found.selected);
      setStep(2);
      await wait(180);
      setStep(3);
      const scraped = await scrapeSelected({ data: { selected: found.selected } });
      if (!scraped.ok) throw new Error(scraped.error);
      setStep(4);
      const synthesized = await synthesizeSelected({
        data: { topic: query, sources: scraped.sources as ScrapedSource[], selected: found.selected },
      });
      if (!synthesized.ok) throw new Error(synthesized.error);
      setStep(5);
      setResult(synthesized);
      setPhase("done");
    } catch (err) {
      setPhase("error");
      setError(err instanceof Error ? err.message : "Research failed.");
    }
  }

  function reset() {
    setPhase("idle");
    setStep(0);
    setError("");
    setSelected([]);
    setResult(null);
  }

  const statusLabel = useMemo(() => {
    if (phase === "running") return STEPS[Math.max(step - 1, 0)];
    if (phase === "error") return "Stopped";
    if (phase === "done") return "Complete";
    return "Ready";
  }, [phase, step]);

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="desk" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-8 sm:px-8 sm:py-12">
        {phase !== "done" ? (
          <section className="stagger-in max-w-2xl">
            <p className="text-[0.72rem] font-medium tracking-[0.16em] text-pine uppercase">
              Autonomous research desk
            </p>
            <h1 className="mt-3 font-display text-[2.15rem] leading-[1.15] font-semibold tracking-[-0.03em] text-ink sm:text-[2.6rem]">
              A topic in. A sourced briefing out.
            </h1>
            <p className="mt-4 max-w-xl text-[1.05rem] leading-relaxed text-muted">
              The agent searches the open web, ranks the three most relevant articles, extracts
              readable text, and writes a structured Markdown report. Source URLs are attached by
              the application — never invented.
            </p>
          </section>
        ) : null}

        <form
          className="rounded-xl bg-surface p-3 shadow-[var(--shadow-border)] sm:p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canRun) void run();
          }}
        >
          <label htmlFor="topic" className="sr-only">
            Research topic
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <span className="mb-2 block px-1 text-[0.7rem] font-medium tracking-[0.14em] text-muted uppercase">
                Research topic
              </span>
              <textarea
                id="topic"
                rows={2}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Impact of artificial intelligence on software development"
                disabled={phase === "running"}
                className="w-full resize-none rounded-md border-0 bg-bg px-3.5 py-3 font-display text-[1.05rem] leading-snug text-ink outline-none ring-1 ring-rule transition-[box-shadow] duration-150 placeholder:text-faint focus:ring-2 focus:ring-pine/35 disabled:opacity-70"
              />
            </div>
            <Button type="submit" size="lg" disabled={!canRun} className="sm:mb-px">
              {phase === "running" ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Working
                </>
              ) : (
                <>
                  Research
                  <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
          {phase === "idle" ? (
            <div className="mt-3 flex flex-wrap gap-2 px-1">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => void run(example)}
                  className="min-h-9 rounded-full bg-bg-subtle px-3 text-left text-[0.8rem] text-ink-soft ring-1 ring-rule transition-colors duration-150 hover:bg-surface-2 hover:text-ink"
                >
                  {example}
                </button>
              ))}
            </div>
          ) : null}
        </form>

        {phase === "running" || phase === "error" ? (
          <section aria-live="polite">
            <div className="mb-4 flex items-baseline justify-between gap-3">
              <p className="text-[0.7rem] font-medium tracking-[0.14em] text-muted uppercase">
                Progress
              </p>
              <p className={cn("text-sm", phase === "running" ? "shimmer" : "text-danger")}>
                {statusLabel}
              </p>
            </div>
            <ol className="grid gap-2">
              {STEPS.map((label, i) => {
                const n = i + 1;
                const state = n < step ? "done" : n === step && phase === "running" ? "active" : "todo";
                return (
                  <li
                    key={label}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm ring-1 ring-rule",
                      state === "active" && "bg-surface",
                      state === "done" && "bg-surface-2/60 text-ink-soft",
                      state === "todo" && "text-faint",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full font-mono text-[0.7rem] tabular-nums",
                        state === "active" && "bg-pine text-pine-fg",
                        state === "done" && "bg-pine/15 text-pine",
                        state === "todo" && "bg-bg-subtle text-faint",
                      )}
                    >
                      {n}
                    </span>
                    <span className={state === "active" ? "font-medium text-ink" : undefined}>
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
            {selected.length > 0 ? (
              <ul className="mt-4 grid gap-2 text-sm">
                {selected.map((hit, i) => (
                  <li key={hit.url} className="truncate text-muted">
                    <span className="tabular-nums text-faint">{i + 1}.</span> {hit.title}
                  </li>
                ))}
              </ul>
            ) : null}
            {error ? (
              <div className="mt-5 rounded-md bg-danger-soft px-4 py-3 text-sm text-danger">
                <p className="font-medium">Could not complete research</p>
                <p className="mt-1 leading-relaxed">{error}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={reset}>
                  Try another topic
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        {phase === "done" && result ? (
          <section className="grid gap-6">
            <div>
              <p className="text-[0.7rem] font-medium tracking-[0.14em] text-pine uppercase">
                Research complete
              </p>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">{result.topic}</h2>
            </div>
            <ReportView
              topic={result.topic}
              markdown={result.reportMarkdown}
              sources={result.sources}
              warnings={result.warnings}
              onReset={reset}
            />
          </section>
        ) : null}
      </main>
      <footer className="border-t border-rule px-5 py-5 text-center text-[0.75rem] text-faint sm:px-8">
        BYTE AVIP 2026 · Generative AI Task 8 · Sources are preserved, not invented.
      </footer>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
