import { Fragment, type ReactNode } from "react";

type Props = { markdown: string; className?: string };

export function Markdown({ markdown, className }: Props) {
  const blocks = splitBlocks(markdown);
  return (
    <div className={className}>
      {blocks.map((block, i) => (
        <Fragment key={i}>{renderBlock(block)}</Fragment>
      ))}
    </div>
  );
}

function splitBlocks(markdown: string): string[] {
  return markdown.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
}

function renderBlock(block: string) {
  const trimmed = block.trim();
  if (!trimmed) return null;
  if (/^#\s+/.test(trimmed)) return <h1>{inline(trimmed.replace(/^#\s+/, ""))}</h1>;
  if (/^##\s+/.test(trimmed)) return <h2>{inline(trimmed.replace(/^##\s+/, ""))}</h2>;
  if (/^###\s+/.test(trimmed)) return <h3>{inline(trimmed.replace(/^###\s+/, ""))}</h3>;
  if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
    const items = trimmed.split("\n").map((line) => line.replace(/^([-*]|\d+\.)\s+/, ""));
    const ordered = /^\d+\./.test(trimmed);
    const List = ordered ? "ol" : "ul";
    return (
      <List>
        {items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </List>
    );
  }
  if (/^_Generated /.test(trimmed)) {
    return <p className="text-faint text-sm italic">{inline(trimmed)}</p>;
  }
  return <p>{inline(trimmed.replace(/\n/g, " "))}</p>;
}

function inline(text: string): ReactNode {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("[")) {
      const m = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m && isSafeHref(m[2])) {
        parts.push(
          <a key={key++} href={m[2]} target="_blank" rel="noreferrer">
            {m[1]}
          </a>,
        );
      } else {
        parts.push(token);
      }
    } else {
      parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function isSafeHref(href: string): boolean {
  return href.startsWith("https://") || href.startsWith("http://") || href.startsWith("mailto:");
}
