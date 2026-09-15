import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import sampleAi from "@/data/sample_report_1.md?raw";
import sampleHeat from "@/data/sample_report_2.md?raw";
import { SiteHeader } from "@/components/site-header";
import { ReportView } from "@/components/report-view";
import { SAMPLES } from "@/lib/research/samples";

const MARKDOWN: Record<string, string> = {
  "ai-software": sampleAi,
  "urban-heat": sampleHeat,
};

export const Route = createFileRoute("/samples/$id")({
  component: SampleDetail,
});

function SampleDetail() {
  const { id } = Route.useParams();
  const sample = SAMPLES.find((s) => s.id === id);
  const markdown = MARKDOWN[id];
  if (!sample || !markdown) throw notFound();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader current="samples" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
        <Link
          to="/samples"
          className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-medium text-muted no-underline hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          All samples
        </Link>
        <div>
          <p className="text-[0.72rem] font-medium tracking-[0.16em] text-pine uppercase">
            Sample report
          </p>
          <h1 className="mt-2 font-display text-[1.9rem] leading-tight font-semibold tracking-tight">
            {sample.topic}
          </h1>
        </div>
        <ReportView topic={sample.topic} markdown={markdown} sources={sample.sources} />
      </main>
    </div>
  );
}
