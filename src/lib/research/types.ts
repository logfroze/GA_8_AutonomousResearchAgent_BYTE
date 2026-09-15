export type SearchHit = {
  title: string;
  url: string;
  snippet: string;
  score: number;
  provider: string;
};

export type ScrapedSource = {
  title: string;
  url: string;
  content: string;
  ok: boolean;
  error?: string;
  charCount: number;
};

export type ResearchOk = {
  ok: true;
  topic: string;
  reportMarkdown: string;
  sources: ScrapedSource[];
  selected: SearchHit[];
  warnings: string[];
};

export type ResearchErr = {
  ok: false;
  error: string;
};

export type ResearchResponse = ResearchOk | ResearchErr;
