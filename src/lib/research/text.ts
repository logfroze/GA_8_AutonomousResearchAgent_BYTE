export const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const SKIP_DOMAINS = [
  "youtube.com",
  "youtu.be",
  "facebook.com",
  "instagram.com",
  "pinterest.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "duckduckgo.com",
  "google.com",
  "bing.com",
];

const TRACKING = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
]);

export function validateTopic(topic: string): string {
  const cleaned = topic.replace(/\s+/g, " ").trim();
  if (!cleaned) throw new Error("Please enter a research topic.");
  if (cleaned.length < 3) {
    throw new Error("Topic is too short. Please enter a more specific research topic.");
  }
  if (cleaned.length > 240) {
    throw new Error("Topic is too long. Please keep it under 240 characters.");
  }
  return cleaned;
}

export function tokenize(text: string): Set<string> {
  const tokens = (text || "").toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return new Set(tokens.filter((t) => t.length > 2));
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

export function isSkippedDomain(url: string): boolean {
  const host = hostnameOf(url);
  return SKIP_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase();
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING.has(key.toLowerCase())) parsed.searchParams.delete(key);
    }
    let out = parsed.toString();
    if (out.endsWith("/")) out = out.slice(0, -1);
    return out;
  } catch {
    return url;
  }
}

export function cleanWhitespace(text: string): string {
  return (text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

export function relevanceScore(topic: string, title: string, snippet: string, url = ""): number {
  const terms = tokenize(topic);
  if (terms.size === 0) return 0;
  const titleHit = intersectionSize(terms, tokenize(title)) / terms.size;
  const snippetHit = intersectionSize(terms, tokenize(snippet)) / terms.size;
  let bonus = 0;
  const host = hostnameOf(url);
  if (host.endsWith(".edu") || host.endsWith(".gov")) bonus += 0.16;
  else if (host.includes("wikipedia.org")) bonus += 0.12;
  else if (host.endsWith(".org")) bonus += 0.06;
  if (url.toLowerCase().endsWith(".pdf")) bonus -= 0.08;
  return Math.round((0.55 * titleHit + 0.35 * snippetHit + bonus) * 10000) / 10000;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const item of a) if (b.has(item)) n += 1;
  return n;
}

export function slugify(text: string, maxLength = 60): string {
  const slug = (text || "")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
  return (slug || "research-report").slice(0, maxLength).replace(/-$/, "");
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&/gi, "&")
    .replace(/"/gi, '"')
    .replace(/&#39;|'/gi, "'")
    .replace(/</gi, "<")
    .replace(/>/gi, ">");
}
