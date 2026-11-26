import type { Fake } from "../fake";

// Google News, for the nightly press survey (import-press): its search, as
// RSS, and its link to each article, which Google's page and its
// batchexecute endpoint turn into the article's own address. The articles
// themselves are news-pages.ts's. Each search answers the pieces dated in
// its after:/before: window, so a night that searches week by week finds
// each piece once.

/** A piece of news Google finds, and where its link leads. */
export type FixtureNews = { id: string; title: string; outlet: string; date: string; url: string };

/** Within the fixture clock's first night of searching, from 8 October 2026 to the 16th. */
export const FIXTURE_NEWS: FixtureNews[] = [
  {
    // Names PauseAI UK in a photo's caption: Claude says it's ours.
    id: "fixture-march",
    title: "Protesters march on Whitehall",
    outlet: "The Example Gazette",
    date: "2026-10-14",
    url: "https://www.examplegazette.co.uk/news/march",
  },
  {
    // PauseAI Global's chief executive, quoted: ours.
    id: "fixture-global",
    title: "Movement founder warns of AI risks",
    outlet: "Example Weekly",
    date: "2026-10-15",
    url: "https://www.exampleweekly.com/founder",
  },
  {
    // "Pause AI" as the plain phrase: not ours.
    id: "fixture-phrase",
    title: "Council votes to pause AI chatbot pilot",
    outlet: "Example Local News",
    date: "2026-10-12",
    url: "https://news.example.org/council-ai",
  },
  {
    // PauseAI US, a different organisation: not ours.
    id: "fixture-us",
    title: "Rally in Washington calls for AI limits",
    outlet: "The Example Times",
    date: "2026-10-10",
    url: "https://www.exampletimes.com/rally",
  },
  {
    // Found by Google's search, but the page never mentions PauseAI: not ours.
    id: "fixture-none",
    title: "AI summit opens in Seoul",
    outlet: "Example Wire",
    date: "2026-10-13",
    url: "https://www.examplewire.com/seoul",
  },
  {
    // Already on /press, from the coverage the migration brought in.
    id: "fixture-known",
    title: "Hedging the AI doomsday risk",
    outlet: "The Japan Times",
    date: "2026-10-09",
    url: "https://www.japantimes.co.jp/commentary/2026/10/07/world/ai-doomsday-risk/",
  },
];

const xml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** The RSS Google News answers a search with, for `news`. */
function newsRss(news: FixtureNews[]): string {
  const items = news.map(
    (piece) => `<item><title>${xml(piece.title)} - ${xml(piece.outlet)}</title>
<link>https://news.google.com/rss/articles/${piece.id}?oc=5</link>
<pubDate>${new Date(`${piece.date}T09:00:00Z`).toUTCString()}</pubDate>
<source url="${new URL(piece.url).origin}">${xml(piece.outlet)}</source></item>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Google News</title>${items.join("")}</channel></rss>`;
}

/** The pieces dated within a query's after: and before: (YYYY-MM-DD), as Google News's search takes them. */
function inWindow(query: string): FixtureNews[] {
  const after = /after:(\d{4}-\d{2}-\d{2})/.exec(query)?.[1] ?? "0000-00-00";
  const before = /before:(\d{4}-\d{2}-\d{2})/.exec(query)?.[1] ?? "9999-99-99";
  return FIXTURE_NEWS.filter((piece) => piece.date >= after && piece.date < before);
}

/** Google's page for an article, with the signature and timestamp its script decodes the link with. */
function articlePage(id: string): Response {
  return new Response(
    `<html><body><c-wiz><div data-n-a-id="${id}" data-n-a-sg="sig-${id}" data-n-a-ts="1760000000"></div></c-wiz></body></html>`,
    {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

/** batchexecute's answer for the article in the request's body, laid out as Google lays it out. */
function decoded(init: RequestInit | undefined): Response | undefined {
  const body = decodeURIComponent(String(init?.body ?? ""));
  const piece = FIXTURE_NEWS.find((news) => body.includes(news.id));
  if (!piece) return new Response(")]}'\n\n[]", { status: 400 });
  const answer = JSON.stringify([
    ["wrb.fr", "Fbv4je", JSON.stringify(["garturlres", piece.url, 1]), null, null, null, "generic"],
  ]);
  return new Response(`)]}'\n\n${answer}\n`, { headers: { "Content-Type": "application/json; charset=utf-8" } });
}

export const googleNewsFake: Fake = ({ hostname, pathname, searchParams }, init) => {
  if (hostname !== "news.google.com") return undefined;
  if (pathname === "/rss/search") {
    return new Response(newsRss(inWindow(searchParams.get("q") ?? "")), {
      headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
    });
  }
  const article = /^\/articles\/([^/]+)$/.exec(pathname);
  if (article) return articlePage(article[1]);
  if (pathname === "/_/DotsSplashUi/data/batchexecute") return decoded(init);
  return undefined;
};
