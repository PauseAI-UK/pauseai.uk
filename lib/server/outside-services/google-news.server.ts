import "server-only";
import { googleNewsFake } from "@/lib/server/fixtures/fakes/google-news";
import { OutsideFailure, refusal } from "./outside-failure.server";
import { outsideFetch, type Outside } from "./outside-fetch.server";

const GOOGLE_NEWS: Outside = { service: "google-news", fake: googleNewsFake };

// Google News, for the nightly press survey (lib/press/survey.server.ts):
// its search, as RSS, in British English, and the article each of its links
// leads to. A link is news.google.com's own, whose page sends a browser on
// with a script, so the article's address comes from the endpoint that
// script calls (batchexecute), with the signature and timestamp Google's
// page for the article carries. None of this is documented by Google; it's
// what open-source decoders do, such as
// https://github.com/SSujitX/google-news-url-decoder. In the UK, Google
// first sends a new visitor to its cookie page, so each request carries the
// cookie it sets when a visitor presses "Reject all".

const LOCALE = { hl: "en-GB", gl: "GB", ceid: "GB:en" };

/** A browser's User-Agent: Google answers a script's with its "unusual traffic" page. */
const AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:130.0) Gecko/20100101 Firefox/130.0";

/** The cookie Google sets when a visitor presses "Reject all" on its cookie page. */
const REJECTED_ALL = "SOCS=CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg";

/** Google News's search for `query`, as the RSS it answers with. Its operators work: after:2026-10-08 before:2026-10-15. */
export async function searchNews(query: string): Promise<string> {
  const url = `https://news.google.com/rss/search?${new URLSearchParams({ q: query, ...LOCALE })}`;
  const res = await outsideFetch(GOOGLE_NEWS, url, { headers: { "User-Agent": AGENT }, cache: "no-store", retries: 2 });
  if (!res.ok) throw refusal("google-news", res, { asked: url });
  return res.text();
}

/** The article's id in a Google News link (…/rss/articles/CBMi…?oc=5), if it is one. */
export function articleId(link: string): string | undefined {
  if (!URL.canParse(link)) return undefined;
  const url = new URL(link);
  if (url.hostname !== "news.google.com") return undefined;
  return /^\/(?:rss\/)?articles\/([^/]+)$/.exec(url.pathname)?.[1];
}

/** The address in batchexecute's answer: ["garturlres","https://…",1], written as a string inside its JSON. */
export function addressIn(answer: string): string | undefined {
  const found = /\\"garturlres\\",\\"(https?:[^"\\]+)\\"/.exec(answer)?.[1];
  return found && URL.canParse(found) ? found : undefined;
}

/** The article's own address that a Google News `link` leads to. */
export async function articleAddress(link: string): Promise<string> {
  const id = articleId(link);
  if (!id) throw new OutsideFailure("google-news", "not-found", { message: `Not a Google News article link: ${link}` });
  const pageUrl = `https://news.google.com/articles/${id}?${new URLSearchParams(LOCALE)}`;
  const page = await outsideFetch(GOOGLE_NEWS, pageUrl, {
    headers: { "User-Agent": AGENT, "Accept-Language": "en-GB,en;q=0.8", Cookie: REJECTED_ALL },
    cache: "no-store",
    redirect: "manual",
  });
  const location = page.headers.get("location");
  // Google sends a visitor it won't serve on: to its "unusual traffic" page (/sorry/) when it takes us for a
  // flood of requests, which is a rate limit, or anywhere else, such as its cookie page, which is a refusal.
  if (location) {
    const blocked = new URL(location, pageUrl).pathname.startsWith("/sorry/");
    throw new OutsideFailure("google-news", blocked ? "rate-limited" : "refused", {
      status: page.status,
      message: `Google sent ${id} on to ${location.slice(0, 120)}`,
    });
  }
  if (!page.ok) throw refusal("google-news", page, { asked: pageUrl });
  const html = await page.text();
  const signature = /data-n-a-sg="([^"]+)"/.exec(html)?.[1];
  const timestamp = /data-n-a-ts="(\d+)"/.exec(html)?.[1];
  if (!signature || !timestamp) {
    throw new OutsideFailure("google-news", "not-found", { message: `Google's page for ${id} has no signature` });
  }
  const request = [
    "Fbv4je",
    `["garturlreq",[["X","X",["X","X"],null,null,1,1,"US:en",null,1,null,null,null,null,null,0,1],"X","X",1,[1,1,1],1,1,null,0,0,null,0],"${id}",${timestamp},"${signature}"]`,
  ];
  const endpoint = "https://news.google.com/_/DotsSplashUi/data/batchexecute";
  const answer = await outsideFetch(GOOGLE_NEWS, endpoint, {
    method: "POST",
    headers: { "User-Agent": AGENT, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: `f.req=${encodeURIComponent(JSON.stringify([[request]]))}`,
    cache: "no-store",
  });
  if (!answer.ok) throw refusal("google-news", answer, { asked: endpoint });
  const address = addressIn(await answer.text());
  if (!address) throw new OutsideFailure("google-news", "not-found", { message: `No address for ${id}` });
  return address;
}
