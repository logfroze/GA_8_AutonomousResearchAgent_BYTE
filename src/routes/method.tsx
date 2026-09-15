import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/method")({ component: MethodPage });

const STEPS = [
  { n: "01", title: "You enter a topic", body: "A plain-language research question is the only required input." },
  { n: "02", title: "Search the web", body: "DuckDuckGo is queried first. Wikipedia, OpenAlex, and Hacker News fill gaps if a query is thin." },
  { n: "03", title: "Rank and select", body: "Hits are scored by title/snippet overlap with the topic. Duplicate URLs, social feeds, and PDFs are dropped. The top three remain." },
  { n: "04", title: "Fetch the pages", body: "Each URL is downloaded with a timeout. A blocked or empty page is recorded, not fatal." },
  { n: "05", title: "Extract and clean", body: "Scripts, navigation, and clutter are removed. Remaining paragraphs are whitespace-normalised." },
  { n: "06", title: "Validate content", body: "Pages that yield too little readable text fall back to the search snippet, or are skipped." },
  { n: "07", title: "Synthesize", body: "The cleaned sources go to an LLM with a strict “use only this material” prompt. If the model is unavailable, an extractive briefing is written from the same sentences." },
  { n: "08", title: "Deduplicate", body: "Overlapping claims are merged. The application, not the model, writes the Sources list so URLs cannot be invented." },
  { n: "09", title: "Save Markdown", body: "A structured report — summary, findings, analysis, conclusion, sources — is written to disk in the Python CLI, or offered as a download here." },
];

function MethodPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="method" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-5 py-8 sm:px-8 sm:py-12">
        <header className="max-w-2xl">
          <p className="text-[0.72rem] font-medium tracking-[0.16em] text-pine uppercase">
            How it works
          </p>
          <h1 className="mt-3 font-display text-[2.1rem] leading-tight font-semibold tracking-[-0.03em]">
            Topic, then the rest is mechanical.
          </h1>
          <p className="mt-3 text-[1.02rem] leading-relaxed text-muted">
            This desk is the live demonstration of the BYTE AVIP 2026 internship agent. The same
            pipeline exists as a Python CLI you can run locally.
          </p>
        </header>

        <ol className="grid gap-px overflow-hidden rounded-xl bg-rule shadow-[var(--shadow-border)]">
          {STEPS.map((step) => (
            <li key={step.n} className="grid gap-2 bg-surface px-5 py-5 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:px-6">
              <p className="font-mono text-sm text-faint tabular-nums">{step.n}</p>
              <div>
                <h2 className="font-sans text-base font-semibold text-ink">{step.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="max-w-2xl">
          <h2 className="font-display text-2xl font-semibold tracking-tight">Limits, stated plainly</h2>
          <ul className="mt-4 grid gap-2 text-sm leading-relaxed text-muted">
            <li>Some sites block automated requests or hide the article behind JavaScript.</li>
            <li>Search quality depends on the provider. Ranking is lexical, not a trained retriever.</li>
            <li>The briefing can only be as good as the extracted source text.</li>
            <li>The language model is instructed not to invent facts. Always open the cited URLs.</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
