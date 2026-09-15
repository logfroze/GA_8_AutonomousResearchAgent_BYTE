import type { SearchHit } from "./types";
import {
  USER_AGENT,
  hostnameOf,
  isSkippedDomain,
  isValidUrl,
  normalizeUrl,
  relevanceScore,
  tokenize,
  validateTopic,
} from "./text";

const HARD_SCRAPE = [
  "academia.edu",
  "researchgate.net",
  "sciencedirect.com",
  "ieeexplore.ieee.org",
  "link.springer.com",
  "jstor.org",
  "wiley.com",
  "onlinelibrary.wiley.com",
  "doi.org",
  "dx.doi.org",
];

export async function searchWeb(topic: string, limit = 3): Promise<SearchHit[]> {
  const query = validateTopic(topic);
  const collected: SearchHit[] = [];

  collected.push(...(await searchDuckDuckGo(query, 10)));
  if (collected.length < 8) collected.push(...(await searchWikipedia(query, 5)));
  if (collected.length < 8) collected.push(...(await searchOpenAlex(query, 5)));
  if (collected.length < 5) collected.push(...(await searchHackerNews(query, 5)));

  const ranked = rankAndDedupe(query, collected);
  if (ranked.length === 0) {
    throw new Error(
      "No usable search results were found for that topic. Try a more specific, well-known subject.",
    );
  }
  return ranked.slice(0, limit);
}

async function searchDuckDuckGo(query: string, maxResults: number): Promise<SearchHit[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const data = (await getJson(url)) as {
      Heading?: string;
      AbstractText?: string;
      AbstractURL?: string;
      RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>;
      Results?: Array<{ Text?: string; FirstURL?: string }>;
    };
    const hits: SearchHit[] = [];
    if (data.AbstractURL && data.Heading) {
      const parsed = candidate(data.Heading, data.AbstractURL, data.AbstractText || "", "duckduckgo");
      if (parsed) hits.push(parsed);
    }
    for (const item of data.Results ?? []) {
      const parsed = candidate(item.Text || "", item.FirstURL || "", item.Text || "", "duckduckgo");
      if (parsed) hits.push(parsed);
    }
    for (const item of data.RelatedTopics ?? []) {
      if (item.FirstURL && item.Text) {
        const parsed = candidate(item.Text.split(" - ")[0] || item.Text, item.FirstURL, item.Text, "duckduckgo");
        if (parsed) hits.push(parsed);
      }
    }
    return hits.slice(0, maxResults);
  } catch {
    return [];
  }
}

async function searchWikipedia(query: string, maxResults: number): Promise<SearchHit[]> {
  try {
    const url =
      "https://en.wikipedia.org/w/api.php?action=query&list=search" +
      `&srsearch=${encodeURIComponent(query)}&srlimit=${maxResults}&format=json&utf8=1&origin=*`;
    const data = (await getJson(url, wikiHeaders())) as {
      query?: { search?: Array<{ title: string; snippet: string }> };
    };
    const hits: SearchHit[] = [];
    for (const hit of data.query?.search ?? []) {
      const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(hit.title.replace(/ /g, "_"))}`;
      const snippet = stripTags(hit.snippet || "");
      const parsed = candidate(hit.title, pageUrl, snippet, "wikipedia");
      if (parsed) hits.push(parsed);
    }
    return hits;
  } catch {
    return [];
  }
}

async function searchOpenAlex(query: string, maxResults: number): Promise<SearchHit[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per_page=${maxResults}`;
    const data = (await getJson(url)) as {
      results?: Array<{
        display_name?: string;
        doi?: string;
        id?: string;
        abstract_inverted_index?: Record<string, number[]>;
        primary_location?: { landing_page_url?: string };
      }>;
    };
    const hits: SearchHit[] = [];
    for (const work of data.results ?? []) {
      let sourceUrl = work.primary_location?.landing_page_url || work.doi || work.id || "";
      if (sourceUrl.startsWith("10.")) sourceUrl = `https://doi.org/${sourceUrl}`;
      const abstract = inflateAbstract(work.abstract_inverted_index);
      const parsed = candidate(work.display_name || "", sourceUrl, abstract.slice(0, 280), "openalex");
      if (parsed) hits.push(parsed);
    }
    return hits;
  } catch {
    return [];
  }
}

async function searchHackerNews(query: string, maxResults: number): Promise<SearchHit[]> {
  try {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${maxResults}`;
    const data = (await getJson(url)) as {
      hits?: Array<{ title?: string; url?: string; story_text?: string }>;
    };
    const hits: SearchHit[] = [];
    for (const hit of data.hits ?? []) {
      const parsed = candidate(hit.title || "", hit.url || "", hit.story_text || hit.title || "", "hackernews");
      if (parsed) hits.push(parsed);
    }
    return hits;
  } catch {
    return [];
  }
}

function candidate(title: string, url: string, snippet: string, provider: string): SearchHit | null {
  if (!title || !url) return null;
  if (!isValidUrl(url) || isSkippedDomain(url)) return null;
  if (url.toLowerCase().endsWith(".pdf")) return null;
  return {
    title: title.slice(0, 240),
    url: normalizeUrl(url),
    snippet: snippet.slice(0, 400),
    score: 0,
    provider,
  };
}

function rankAndDedupe(topic: string, results: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const hostCount = new Map<string, number>();
  const scored: SearchHit[] = [];
  for (const item of results) {
    const key = item.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    let score = relevanceScore(topic, item.title, item.snippet, item.url);
    const host = hostnameOf(item.url);
    if (HARD_SCRAPE.some((d) => host === d || host.endsWith(`.${d}`))) score -= 0.35;
    scored.push({ ...item, score });
  }
  scored.sort((a, b) => b.score - a.score);
  const topicTerms = tokenize(topic);
  const ranked: SearchHit[] = [];
  for (const item of scored) {
    const host = hostnameOf(item.url);
    if ((hostCount.get(host) ?? 0) >= 2) continue;
    if (item.score < 0.08 && !host.includes("wikipedia.org") && !host.endsWith(".gov")) continue;
    const titleTerms = tokenize(item.title);
    let overlap = false;
    for (const t of topicTerms) if (titleTerms.has(t)) overlap = true;
    if (ranked.length && !overlap && item.score < 0.2) continue;
    hostCount.set(host, (hostCount.get(host) ?? 0) + 1);
    ranked.push(item);
  }
  return ranked;
}

async function getJson(url: string, headers?: HeadersInit): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...headers,
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function wikiHeaders(): HeadersInit {
  return {
    "User-Agent": "AutonomousResearchAgent/1.0 (BYTE AVIP 2026 internship project; educational use)",
  };
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").replace(/"/g, '"').replace(/&/g, "&").trim();
}

function inflateAbstract(inverted?: Record<string, number[]>): string {
  if (!inverted) return "";
  const positions: Array<[number, string]> = [];
  for (const [word, indexes] of Object.entries(inverted)) {
    for (const index of indexes) positions.push([index, word]);
  }
  positions.sort((a, b) => a[0] - b[0]);
  return positions.map(([, word]) => word).join(" ");
}
