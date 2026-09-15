import type { ScrapedSource, SearchHit } from "./types";
import { USER_AGENT, cleanWhitespace, decodeEntities, hostnameOf } from "./text";

const MIN_USABLE = 220;
const MAX_CHARS = 9000;

export async function scrapeSources(results: SearchHit[]): Promise<ScrapedSource[]> {
  return Promise.all(results.map((r) => scrapeOne(r.title, r.url, r.snippet)));
}

export async function scrapeOne(title: string, url: string, snippet = ""): Promise<ScrapedSource> {
  const host = hostnameOf(url);
  if (host.includes("wikipedia.org")) {
    const wiki = await scrapeWikipedia(title, url);
    if (wiki.ok) return wiki;
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return fallback(title, url, snippet, `${host} returned HTTP ${res.status}`);
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    if (contentType.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
      return fallback(title, url, snippet, "PDF files are skipped (HTML articles only)");
    }
    const html = await res.text();
    const extracted = extractReadableText(html, title);
    if (extracted.content.length < MIN_USABLE) {
      return fallback(title || extracted.title, url, snippet, `Not enough readable article text on ${host}`);
    }
    return {
      title: extracted.title || title,
      url,
      content: extracted.content.slice(0, MAX_CHARS),
      ok: true,
      charCount: Math.min(extracted.content.length, MAX_CHARS),
    };
  } catch (err) {
    const name = err instanceof Error ? err.name : "Error";
    const message =
      name === "TimeoutError" || name === "AbortError"
        ? `Timed out after 12s (${host})`
        : `Could not fetch ${host}: ${name}`;
    return fallback(title, url, snippet, message);
  }
}

async function scrapeWikipedia(title: string, url: string): Promise<ScrapedSource> {
  let pageTitle = title;
  const marker = "/wiki/";
  if (url.includes(marker)) {
    pageTitle = decodeURIComponent(url.split(marker).pop() || title).replace(/_/g, " ");
  }
  try {
    const api =
      "https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exsectionformat=plain" +
      `&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`;
    const res = await fetch(api, {
      headers: {
        "User-Agent": "AutonomousResearchAgent/1.0 (BYTE AVIP 2026 internship project; educational use)",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return { title, url, content: "", ok: false, error: `Wikipedia HTTP ${res.status}`, charCount: 0 };
    const data = (await res.json()) as {
      query?: { pages?: Record<string, { title?: string; extract?: string }> };
    };
    const page = Object.values(data.query?.pages ?? {})[0];
    const extract = cleanWhitespace(page?.extract || "");
    const resolved = page?.title || title;
    if (extract.length < MIN_USABLE) {
      return { title: resolved, url, content: "", ok: false, error: "empty Wikipedia extract", charCount: 0 };
    }
    return {
      title: resolved,
      url,
      content: extract.slice(0, MAX_CHARS),
      ok: true,
      charCount: Math.min(extract.length, MAX_CHARS),
    };
  } catch (err) {
    return { title, url, content: "", ok: false, error: err instanceof Error ? err.message : "Wikipedia failed", charCount: 0 };
  }
}

function extractReadableText(html: string, fallbackTitle: string): { title: string; content: string } {
  const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? cleanWhitespace(stripTags(titleMatch[1])) : fallbackTitle;

  let body = html.replace(/<(script|style|noscript|iframe|svg|canvas|form|nav|footer|header|aside)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const article =
    body.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
    body.match(/<main[\s\S]*?<\/main>/i)?.[0] ||
    body;
  const blocks = [...article.matchAll(/<(p|h2|h3|li)[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map((m) => cleanWhitespace(stripTags(m[2] || "")))
    .filter((p) => p.length >= 40);
  let content = blocks.join("\n\n");
  if (content.length < MIN_USABLE) {
    content = cleanWhitespace(stripTags(article));
  }
  return { title, content };
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " "));
}

function fallback(title: string, url: string, snippet: string, error: string): ScrapedSource {
  const cleaned = cleanWhitespace(snippet);
  if (cleaned.length >= 80) {
    return {
      title,
      url,
      content: `(Full page could not be extracted: ${error})\n\n${cleaned}`,
      ok: true,
      error,
      charCount: cleaned.length,
    };
  }
  return { title, url, content: "", ok: false, error, charCount: 0 };
}
