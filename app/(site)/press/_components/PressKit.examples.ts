import type { CoverageItem } from "@/lib/press/coverage";

// Coverage for the press kit's tests and gallery example, newest first as
// /press lists it: an outlet with two pieces, a clip cross-posted to two
// platforms, and a piece with no date.
export const EXAMPLE_COVERAGE: CoverageItem[] = [
  {
    id: 3,
    outlet: "The Example Gazette",
    title: "Protesters march on Whitehall",
    medium: "Article",
    url: "https://www.example.com/march",
    date: "2026-09-16",
  },
  {
    id: 2,
    outlet: "Example News",
    title: "Activists stage protest outside Downing Street",
    medium: "Video",
    links: [
      { label: "YouTube", url: "https://www.example.com/video" },
      { label: "X", url: "https://x.example.com/video" },
    ],
    date: "2026-09-16",
  },
  {
    id: 1,
    outlet: "The Example Gazette",
    title: "Campaigners call for a pause on AI",
    medium: "Article",
    url: "https://www.example.com/pause",
  },
];
