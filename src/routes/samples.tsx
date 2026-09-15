import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SAMPLES } from "@/lib/research/samples";

export const Route = createFileRoute("/samples")({ component: SamplesPage });

function SamplesPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="samples" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <header className="max-w-2xl">
          <p className="text-[0.72rem] font-medium tracking-[0.16em] text-pine uppercase">
            Worked examples
          </p>
          <h1 className="mt-3 font-display text-[2.1rem] leading-tight font-semibold tracking-[-0.03em]">
            Two reports from the live pipeline.
          </h1>
          <p className="mt-3 text-[1.02rem] leading-relaxed text-muted">
            These were produced by running the agent on real topics — search, scrape, synthesis,
            then the original URLs. They are not placeholder citations.
          </p>
        </header>
        <ul className="grid gap-4 md:grid-cols-2">
          {SAMPLES.map((sample, index) => (
            <li key={sample.id}>
              <Link
                to="/samples/$id"
                params={{ id: sample.id }}
                className="flex h-full flex-col rounded-xl bg-surface p-5 no-underline shadow-[var(--shadow-border)] transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 sm:p-6"
              >
                <p className="font-mono text-[0.7rem] tracking-wide text-faint tabular-nums">
                  Sample {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-3 font-display text-xl leading-snug font-semibold text-ink">
                  {sample.topic}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{sample.blurb}</p>
                <p className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-pine">
                  Open report
                  <ArrowUpRight className="size-4" />
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
