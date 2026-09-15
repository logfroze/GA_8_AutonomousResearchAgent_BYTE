export type SampleMeta = {
  id: string;
  topic: string;
  blurb: string;
  sources: Array<{ title: string; url: string }>;
};

export const SAMPLES: SampleMeta[] = [
  {
    id: "ai-software",
    topic: "Impact of artificial intelligence on software development",
    blurb: "How AI is changing the software lifecycle — from design through testing — drawn from three live web sources.",
    sources: [
      {
        title: "The Impact of Artificial Intelligence on Software Development",
        url: "https://techinfer.com/impact-of-artificial-intelligence-on-software-development",
      },
      {
        title: "Journal of Information Systems Engineering and Management",
        url: "https://www.jisem-journal.com/index.php/journal/article/view/4039",
      },
      {
        title: "How Will Artificial Intelligence (AI) Impact Software Development?",
        url: "https://www.clariontech.com/blog/how-will-artificial-intelligence-impact-software-development",
      },
    ],
  },
  {
    id: "urban-heat",
    topic: "Urban heat islands and green infrastructure",
    blurb: "EPA and related sources on trees, green roofs, and vegetation as a practical response to urban heat.",
    sources: [
      {
        title: "US EPA — Reduce Urban Heat Island Effect",
        url: "https://19january2021snapshot.epa.gov/green-infrastructure/reduce-urban-heat-island-effect_.html",
      },
      {
        title: "Urban Heat Island Mitigation with Green Infrastructure",
        url: "https://prism.sustainability-directory.com/scenario/urban-heat-island-mitigation-with-green-infrastructure",
      },
      {
        title: "Reduce Heat Islands — US EPA",
        url: "https://www.epa.gov/green-infrastructure/reduce-heat-islands",
      },
    ],
  },
];
