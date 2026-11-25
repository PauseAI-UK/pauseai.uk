import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { cardFrom, linkCard } from "./link-pages.server";

// Every name resolves to a public address but intranet.example.org, which is on a private network.
vi.mock("node:dns/promises", () => ({
  lookup: async (name: string) => [
    { address: name === "intranet.example.org" ? "10.0.0.5" : "93.184.215.14", family: 4 },
  ],
}));

const PAGE = "https://www.example.org/march";

/** A redirect to a path on the same site. */
const moved = (path: string) => new HttpResponse(null, { status: 301, headers: { location: path } });
const at = new URL(PAGE);

/** A page's head with these tags. */
const head = (tags: string) => `<!doctype html><html><head>${tags}</head><body>Hello</body></html>`;

describe("cardFrom", () => {
  it("makes a card of a page's og:title and og:description, with the link's site", () => {
    const html = head(`<meta property="og:title" content="The march">
      <meta property="og:description" content="Saturday in London">`);
    expect(cardFrom(html, at)).toEqual({
      title: "The march",
      description: "Saturday in London",
      site: "www.example.org",
    });
  });

  it("reads tags by name too, quoted either way or bare, in any case, the first of each", () => {
    const html = head(`<META NAME='OG:TITLE' CONTENT='First'><meta name="og:title" content="Second">
      <meta content=Bare property=og:description><meta charset="utf-8"><meta property="og:image">`);
    expect(cardFrom(html, at)).toMatchObject({ title: "First", description: "Bare" });
  });

  it("turns character references into characters, leaving one it doesn't know", () => {
    const html = head(`<meta property="og:title" content=" Tom &amp; Jerry&#39;s &#x2014; &quot;day&quot;&nbsp;">
      <meta property="og:description" content="&lt;b&gt; &apos;n&apos; &unknown;">`);
    expect(cardFrom(html, at)).toMatchObject({ title: 'Tom & Jerry\'s — "day"', description: "<b> 'n' &unknown;" });
  });

  it("makes no card without a description or a title, or with one empty", () => {
    expect(cardFrom(head(`<meta property="og:title" content="Only a title">`), at)).toBeNull();
    expect(cardFrom(head(`<meta property="og:description" content="Only words">`), at)).toBeNull();
    expect(
      cardFrom(head(`<meta property="og:title" content=" "><meta property="og:description" content="Words">`), at),
    ).toBeNull();
  });

  it("reads only the first 300 KB, as WhatsApp does", () => {
    const late = `${" ".repeat(300 * 1024)}<meta property="og:title" content="Late">`;
    expect(cardFrom(head(`<meta property="og:description" content="Words">${late}`), at)).toBeNull();
  });
});

describe("linkCard", () => {
  it("asks the page as WhatsApp does, and makes its card", async () => {
    let agent: string | null = null;
    server.use(
      http.get(PAGE, ({ request }) => {
        agent = request.headers.get("user-agent");
        return HttpResponse.html(
          head(`<meta property="og:title" content="The march"><meta property="og:description" content="Saturday">`),
        );
      }),
    );
    expect(await linkCard(PAGE)).toEqual({ title: "The march", description: "Saturday", site: "www.example.org" });
    expect(agent).toMatch(/^WhatsApp\/2\.[\d.]+ A$/);
  });

  it("reads a page by http:// too", async () => {
    server.use(
      http.get("http://example.org/", () =>
        HttpResponse.html(head(`<meta property="og:title" content="T"><meta property="og:description" content="D">`)),
      ),
    );
    expect(await linkCard("http://example.org/")).toMatchObject({ site: "example.org" });
  });

  it("makes no card for an address that isn't a web page's", async () => {
    expect(await linkCard("not a link")).toBeNull();
    expect(await linkCard("mailto:jane.smith@example.com")).toBeNull();
  });

  it("makes no card when the page refuses or can't be reached", async () => {
    server.use(http.get(PAGE, () => new HttpResponse("Gone", { status: 404 })));
    expect(await linkCard(PAGE)).toBeNull();
    server.use(http.get(PAGE, () => HttpResponse.error()));
    expect(await linkCard(PAGE)).toBeNull();
  });

  it("asks nothing of an internal address, named or by number", async () => {
    let asked = 0;
    server.use(
      http.get("http://intranet.example.org/", () => {
        asked++;
        return HttpResponse.html(
          head(`<meta property="og:title" content="T"><meta property="og:description" content="D">`),
        );
      }),
    );
    expect(await linkCard("http://intranet.example.org/")).toBeNull();
    expect(await linkCard("http://169.254.169.254/latest/meta-data/")).toBeNull();
    expect(await linkCard("http://[::1]/")).toBeNull();
    expect(asked).toBe(0);
  });

  it("follows a redirect to its page, with the card for the link's own site", async () => {
    server.use(
      http.get("https://short.example.org/m", () => moved("/march-page")),
      http.get("https://short.example.org/march-page", () => HttpResponse.redirect(PAGE, 302)),
      http.get(PAGE, () =>
        HttpResponse.html(head(`<meta property="og:title" content="T"><meta property="og:description" content="D">`)),
      ),
    );
    expect(await linkCard("https://short.example.org/m")).toEqual({
      title: "T",
      description: "D",
      site: "short.example.org",
    });
  });

  it("follows no redirect to an internal address, or to one that isn't a web page's", async () => {
    let asked = 0;
    server.use(
      http.get("https://www.example.org/inside", () => HttpResponse.redirect("http://intranet.example.org/", 302)),
      http.get("https://www.example.org/mail", () => HttpResponse.redirect("mailto:jane.smith@example.com", 302)),
      http.get("http://intranet.example.org/", () => {
        asked++;
        return HttpResponse.html(
          head(`<meta property="og:title" content="T"><meta property="og:description" content="D">`),
        );
      }),
    );
    expect(await linkCard("https://www.example.org/inside")).toBeNull();
    expect(await linkCard("https://www.example.org/mail")).toBeNull();
    expect(asked).toBe(0);
  });

  it("gives up on a link that redirects too many times, and makes no card of a redirect with nowhere to go", async () => {
    server.use(
      http.get("https://www.example.org/loop", () => moved("/loop")),
      http.get("https://www.example.org/nowhere", () => new HttpResponse(null, { status: 302 })),
    );
    expect(await linkCard("https://www.example.org/loop")).toBeNull();
    expect(await linkCard("https://www.example.org/nowhere")).toBeNull();
  });
});
