import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { excerpts, readPage } from "./page";

const article = readFileSync(join(__dirname, "samples", "article.html"), "utf8");

describe("readPage", () => {
  it("reads a stored article's title, outlet, date, captions and text", () => {
    const page = readPage(article);
    expect(page.title).toBe("Protesters march on Whitehall & Parliament - The Example Gazette");
    expect(page.siteName).toBe("The Example Gazette");
    expect(page.published).toBe("2026-11-10");
    expect(page.captions).toEqual([
      "Campaigners from PauseAI UK outside Downing Street. Photo: Jane Smith",
      "Marchers on Whitehall",
    ]);
    expect(page.text).toContain("“We are asking for a treaty,” said Jane Smith, a volunteer with Pause AI's UK branch");
    expect(page.text).toContain("Leeds & back");
    expect(page.text).not.toMatch(/font-family|NewsArticle|comment|noscript|drawing/);
  });

  it("falls back to the <title>, and dates given other ways", () => {
    expect(readPage("<title>Plain</title><meta itemprop='datePublished' content='2026-01-02'>")).toEqual({
      title: "Plain",
      siteName: undefined,
      published: "2026-01-02",
      captions: [],
      text: "Plain",
    });
    expect(readPage('<script>{"datePublished": "2026-03-04T00:00"}</script>').published).toBe("2026-03-04");
    expect(readPage('<meta name="article:published_time" content="yesterday">')).toEqual({
      title: undefined,
      siteName: undefined,
      published: undefined,
      captions: [],
      text: "",
    });
  });
});

describe("excerpts", () => {
  const text = `${"a".repeat(50)} Pause AI ${"b".repeat(50)} PauseAI ${"c".repeat(300)} pause ai end`;

  it("gives the passage around each mention, joining ones that overlap", () => {
    const found = excerpts(text, /\bpause ?ai\b/gi, 60);
    expect(found).toHaveLength(2);
    expect(found[0]).toMatch(/^a+ Pause AI b+ PauseAI c+$/);
    expect(found[1]).toMatch(/^c+ pause ai end$/);
  });

  it("gives at most as many as asked, and none without a mention", () => {
    expect(excerpts(text, /\bpause ?ai\b/gi, 10, 1)).toHaveLength(1);
    expect(excerpts("nothing here", /\bpause ?ai\b/gi)).toEqual([]);
  });
});
