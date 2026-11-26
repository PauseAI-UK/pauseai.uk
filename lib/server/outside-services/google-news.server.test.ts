import { describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { FIXTURE_NEWS } from "@/lib/server/fixtures/fakes/google-news";
import { addressIn, articleAddress, articleId, searchNews } from "./google-news.server";

const SEARCH = "https://news.google.com/rss/search";
const PAGE = "https://news.google.com/articles/:id";
const BATCH = "https://news.google.com/_/DotsSplashUi/data/batchexecute";

const [first] = FIXTURE_NEWS;
const LINK = `https://news.google.com/rss/articles/${first.id}?oc=5`;

/** Google's page for an article, carrying these attributes. */
const articlePage = (attributes: string) => HttpResponse.html(`<html><body><div ${attributes}></div></body></html>`);

describe("searchNews", () => {
  it("searches in British English as a browser, and gives the RSS", async () => {
    let asked: URL | undefined;
    let agent: string | null = null;
    server.use(
      http.get(SEARCH, ({ request }) => {
        asked = new URL(request.url);
        agent = request.headers.get("user-agent");
        return HttpResponse.text("<rss></rss>");
      }),
    );
    expect(await searchNews('"PauseAI" after:2026-10-08')).toBe("<rss></rss>");
    expect(asked?.searchParams.get("q")).toBe('"PauseAI" after:2026-10-08');
    expect(asked?.searchParams.get("hl")).toBe("en-GB");
    expect(agent).toMatch(/^Mozilla\/5\.0/);
  });

  it("fails as the status says when Google refuses", async () => {
    server.use(http.get(SEARCH, () => new HttpResponse("Oops", { status: 500 })));
    await expect(searchNews("PauseAI")).rejects.toMatchObject({ service: "google-news", kind: "refused", status: 500 });
  });
});

describe("articleId", () => {
  it("is the id in a Google News link, from its feed or its site", () => {
    expect(articleId("https://news.google.com/rss/articles/CBMiAbc?oc=5")).toBe("CBMiAbc");
    expect(articleId("https://news.google.com/articles/CBMiAbc")).toBe("CBMiAbc");
  });

  it("is none for another site's link, another of Google's pages, or no link at all", () => {
    expect(articleId("https://www.example.org/articles/CBMiAbc")).toBeUndefined();
    expect(articleId("https://news.google.com/topics/CBMiAbc")).toBeUndefined();
    expect(articleId("https://news.google.com/rss/articles/CBMiAbc/more")).toBeUndefined();
    expect(articleId("not a link")).toBeUndefined();
  });
});

describe("addressIn", () => {
  it("is the address in batchexecute's answer", () => {
    const answer = JSON.stringify([["wrb.fr", "Fbv4je", JSON.stringify(["garturlres", "https://example.org/a", 1])]]);
    expect(addressIn(answer)).toBe("https://example.org/a");
  });

  it("is none for an answer without one, or with one that isn't an address", () => {
    expect(addressIn("[]")).toBeUndefined();
    expect(addressIn(JSON.stringify([JSON.stringify(["garturlres", "https://[", 1])]))).toBeUndefined();
  });
});

describe("articleAddress", () => {
  it("decodes a link with the signature and timestamp on Google's page", async () => {
    expect(await articleAddress(LINK)).toBe(first.url);
  });

  it("asks nothing of a link that isn't Google News's", async () => {
    await expect(articleAddress("https://www.example.org/a")).rejects.toMatchObject({
      service: "google-news",
      kind: "not-found",
    });
  });

  it("is rate-limited when Google sends us to its unusual traffic page", async () => {
    server.use(
      http.get(PAGE, () => new HttpResponse(null, { status: 302, headers: { location: "/sorry/index?continue=x" } })),
    );
    await expect(articleAddress(LINK)).rejects.toMatchObject({
      service: "google-news",
      kind: "rate-limited",
      status: 302,
    });
  });

  it("is refused when Google sends us anywhere else, such as its cookie page", async () => {
    server.use(
      http.get(
        PAGE,
        () => new HttpResponse(null, { status: 302, headers: { location: "https://consent.google.com/ml?gl=GB" } }),
      ),
    );
    await expect(articleAddress(LINK)).rejects.toMatchObject({ service: "google-news", kind: "refused", status: 302 });
  });

  it("fails as the status says when Google's page refuses", async () => {
    server.use(http.get(PAGE, () => new HttpResponse("Gone", { status: 404 })));
    await expect(articleAddress(LINK)).rejects.toMatchObject({
      service: "google-news",
      kind: "not-found",
      status: 404,
    });
  });

  it("finds nothing when Google's page lacks the signature or the timestamp", async () => {
    server.use(http.get(PAGE, () => articlePage(`data-n-a-ts="1760000000"`)));
    await expect(articleAddress(LINK)).rejects.toMatchObject({ service: "google-news", kind: "not-found", status: 0 });
    server.use(http.get(PAGE, () => articlePage(`data-n-a-sg="sig"`)));
    await expect(articleAddress(LINK)).rejects.toMatchObject({ service: "google-news", kind: "not-found", status: 0 });
  });

  it("fails as the status says when batchexecute refuses", async () => {
    server.use(http.post(BATCH, () => new HttpResponse("Bad request", { status: 400 })));
    await expect(articleAddress(LINK)).rejects.toMatchObject({ service: "google-news", kind: "refused", status: 400 });
  });

  it("finds nothing when batchexecute's answer has no address", async () => {
    server.use(http.post(BATCH, () => HttpResponse.text(")]}'\n\n[]")));
    await expect(articleAddress(LINK)).rejects.toMatchObject({ service: "google-news", kind: "not-found", status: 0 });
  });
});
