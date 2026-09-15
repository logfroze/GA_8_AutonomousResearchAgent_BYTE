import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/components/markdown";
import { slugify } from "@/lib/research/text";

type SourceLink = { title: string; url: string };

type Props = {
  topic: string;
  markdown: string;
  sources: SourceLink[];
  warnings?: string[];
  onReset?: () => void;
};

export function ReportView({ topic, markdown, sources, warnings, onReset }: Props) {
  function download() {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(topic)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16.5rem]">
      <article className="report-prose rounded-xl bg-surface px-5 py-7 shadow-[var(--shadow-border)] sm:px-8 sm:py-9">
        <Markdown markdown={markdown} />
      </article>
      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-lg bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-[0.7rem] font-medium tracking-[0.14em] text-muted uppercase">Sources</p>
          <ol className="mt-3 grid gap-3">
            {sources.map((source, i) => (
              <li key={source.url} className="text-sm leading-snug">
                <span className="text-faint tabular-nums">{i + 1}.</span>{" "}
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-pine underline decoration-rule underline-offset-3 hover:decoration-pine"
                >
                  {source.title}
                </a>
              </li>
            ))}
          </ol>
        </div>
        {warnings && warnings.length > 0 ? (
          <div className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
            <p className="font-medium">Notes</p>
            <ul className="mt-1 grid gap-1 text-[0.8rem] leading-snug">
              {warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Button onClick={download} className="w-full">
            <Download className="size-4" />
            Download Markdown
          </Button>
          {onReset ? (
            <Button variant="secondary" onClick={onReset} className="w-full">
              <RotateCcw className="size-4" />
              New topic
            </Button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
