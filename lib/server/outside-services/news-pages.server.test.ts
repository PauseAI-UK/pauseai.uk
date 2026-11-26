import { describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { newsPage } from "./news-pages.server";

// Every name resolves to a public address but intranet.example.org, which is on a private network.
vi.mock("node:dns/promises", () => ({
  lookup: async (name: string) => [
    { address: name === "intranet.example.org" ? "10.0.0.5" : "93.184.215.14", family: 4 },
  ],
}));

const PAGE = "https://www.examplegazette.co.uk/news/march";

/** A redirect to `location`. */
const moved = (location: string) => new HttpResponse(null, { status: 301, headers: { location } });

describe("newsPage", () => {
  it("reads an article's page, as the fake answers it", async () => {
    const { url, html } = await newsPage(PAGE);
    expect(url).toBe(PAGE);
    expect(html).toContain("Protesters march on Whitehall");
  });

  it("asks as a browser, by http:// too", async () => {
    let agent: string | null = null;
    server.use(
      http.get("http://example.org/a", ({ request }) => {
        agent = request.headers.get("user-agent");
        return HttpResponse.html("<p>Hello</p>");
      }),
    );
    expect(await newsPage("http://example.org/a")).toEqual({ url: "http://example.org/a", html: "<p>Hello</p>" });
    expect(agent).toMatch(/^Mozilla\/5\.0/);
  });

  it("reads only the first 3 MB of a page", async () => {
    server.use(http.get("https://example.org/long", () => HttpResponse.html("a".repeat(3_000_001))));
    expect((await newsPage("https://example.org/long")).html).toHaveLength(3_000_000);
  });

  it("follows redirects, relative or not, and gives the address it ended at", async () => {
    server.use(
      http.get("https://short.example.org/m", () => moved("/march")),
      http.get("https://short.example.org/march", () => moved(PAGE)),
    );
    expect((await newsPage("https://short.example.org/m")).url).toBe(PAGE);
  });

  it("gives up on an address that redirects too many times", async () => {
    let asked = 0;
    server.use(
      http.get("https://example.org/loop", () => {
        asked++;
        return moved("/loop");
      }),
    );
    await expect(newsPage("https://example.org/loop")).rejects.toMatchObject({
      service: "news-page",
      kind: "not-found",
    });
    expect(asked).toBe(6);
  });

  it("reads nothing at an address that isn't a web page's, or that redirects to one", async () => {
    server.use(http.get("https://example.org/mail", () => moved("mailto:jane.smith@example.com")));
    await expect(newsPage("mailto:jane.smith@example.com")).rejects.toMatchObject({
      service: "news-page",
      kind: "not-found",
    });
    await expect(newsPage("https://example.org/mail")).rejects.toMatchObject({
      service: "news-page",
      kind: "not-found",
    });
  });

  it("asks nothing of an internal address, or one a redirect leads to", async () => {
    let asked = 0;
    server.use(
      http.get("https://example.org/inside", () => moved("http://intranet.example.org/")),
      http.get("http://intranet.example.org/", () => {
        asked++;
        return HttpResponse.html("<p>Inside</p>");
      }),
    );
    await expect(newsPage("http://intranet.example.org/")).rejects.toMatchObject({
      service: "news-page",
      kind: "unreachable",
    });
    await expect(newsPage("https://example.org/inside")).rejects.toMatchObject({
      service: "news-page",
      kind: "unreachable",
    });
    expect(asked).toBe(0);
  });

  it("fails as the status says when the site refuses, or redirects with nowhere to go", async () => {
    server.use(
      http.get("https://example.org/gone", () => new HttpResponse("Gone", { status: 404 })),
      http.get("https://example.org/nowhere", () => new HttpResponse(null, { status: 302 })),
    );
    await expect(newsPage("https://example.org/gone")).rejects.toMatchObject({
      service: "news-page",
      kind: "not-found",
      status: 404,
    });
    await expect(newsPage("https://example.org/nowhere")).rejects.toMatchObject({
      service: "news-page",
      kind: "refused",
      status: 302,
    });
  });

  it("finds no web page in an answer that isn't HTML, or doesn't say what it is", async () => {
    server.use(
      http.get("https://example.org/report.pdf", () =>
        HttpResponse.arrayBuffer(new ArrayBuffer(4), { headers: { "Content-Type": "application/pdf" } }),
      ),
      // Bytes, unlike a string, carry no Content-Type of their own.
      http.get("https://example.org/unsaid", () => new HttpResponse(new TextEncoder().encode("<p>Hello</p>"))),
    );
    await expect(newsPage("https://example.org/report.pdf")).rejects.toMatchObject({
      service: "news-page",
      kind: "not-found",
      status: 0,
    });
    await expect(newsPage("https://example.org/unsaid")).rejects.toMatchObject({
      service: "news-page",
      kind: "not-found",
      status: 0,
    });
  });
});
