import "server-only";
import { newsPagesFake } from "@/lib/server/fixtures/fakes/news-pages";
import { OutsideFailure, refusal } from "./outside-failure.server";
import { outsideFetch, type Outside } from "./outside-fetch.server";

const NEWS_PAGE: Outside = { service: "news-page", fake: newsPagesFake };

// A news article the press survey reads (lib/press/survey.server.ts), at
// the address Google News's link leads to. Any site, so each redirect is
// followed here and checked as the address is: a web page on the public
// internet, never one of ours.

/** A browser's User-Agent, as some news sites refuse others. */
const AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.0; rv:130.0) Gecko/20100101 Firefox/130.0";

/** How many redirects an address may take to reach its page. */
const MAX_REDIRECTS = 5;

/** How much of a page is read: enough for any article's text. */
const MOST = 3_000_000;

/** The page at `address`, as HTML, and the address it was at after any redirects. */
export async function newsPage(address: string): Promise<{ url: string; html: string }> {
  let url = new URL(address);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "https:" && url.protocol !== "http:") break;
    const res = await outsideFetch(NEWS_PAGE, url.href, {
      headers: { "User-Agent": AGENT, Accept: "text/html", "Accept-Language": "en-GB,en;q=0.8" },
      cache: "no-store",
      redirect: "manual",
      publicOnly: true,
      // The BBC's and ITV's pages, among others, answer with more headers than fetch takes.
      largeHeaders: true,
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status <= 399 && location !== null) {
      url = new URL(location, url);
      continue;
    }
    if (!res.ok) throw refusal("news-page", res, { asked: url.href });
    if (!/html/i.test(res.headers.get("content-type") ?? "")) {
      throw new OutsideFailure("news-page", "not-found", { message: `${url.href} isn't a web page` });
    }
    return { url: url.href, html: (await res.text()).slice(0, MOST) };
  }
  throw new OutsideFailure("news-page", "not-found", { message: `${address} didn't lead to a web page` });
}
