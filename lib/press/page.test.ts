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

  /** A paragraph of an article's length: a page with one is enough for Readability to take it for an article. */
  const paragraph = (first: string) =>
    `<p>${first} ${"The march went on through the afternoon, past Parliament and down Whitehall. ".repeat(8)}</p>`;

  /** A news page: a menu that names us, the article, and a sidebar with another story's picture. */
  const newsPage = (extra = "") => `<html><head><title>The march</title></head><body>
    <nav><a href="/">PauseAI in the menu</a></nav>
    <article><h1>The march</h1>
      <figure><img src="a.jpg" alt="Marchers"><figcaption>PauseAI UK outside Downing Street</figcaption></figure>
      ${paragraph("First.")}${paragraph("Second.")}
    </article>
    <aside><img src="b.jpg" alt="Another story"></aside>${extra}</body></html>`;

  it("reads the article Readability finds, without the page's menus or other stories", () => {
    const page = readPage(newsPage());
    expect(page.text).toMatch(/^PauseAI UK outside Downing Street First\. The march went on/);
    expect(page.text).toContain("Second.");
    expect(page.text).not.toContain("PauseAI in the menu");
    expect(page.captions).toEqual(["PauseAI UK outside Downing Street", "Marchers"]);
  });

  it("keeps the article's paragraphs apart, as words, not run together", () => {
    const page = readPage(
      newsPage().replace("</article>", "<p>The day ended.</p><p>Then the rain came.</p></article>"),
    );
    expect(page.text).toContain("The day ended. Then the rain came.");
  });

  // Some pages close the document early, ahead of the article, and a browser reads on as if they hadn't.
  it("reads the article that comes after a page closes its body and document early", () => {
    const page = readPage(
      `<html><head><title>The march</title></head><body><nav>Menu</nav></body></html>
       <div><main><article><h1>The march</h1>${paragraph("First.")}${paragraph("Second.")}</article></main></div>
       <footer>Footer</footer></body></html>`,
    );
    expect(page.text).toMatch(/^First\. The march went on/);
    expect(page.text).toContain("Second.");
    expect(page.text).not.toMatch(/Menu|Footer/);
  });

  it("reads a page with too many elements to be an article whole", () => {
    const page = readPage(newsPage(`<div>${"<span></span>".repeat(30_000)}</div>`));
    expect(page.text).toContain("PauseAI in the menu");
    expect(page.captions).toContain("Another story");
  });

  // Readability passes over what's hidden, which the check of whether a page is an article doesn't,
  // so a hidden paragraph makes a page that's taken for an article whose text Readability can't find.
  it("reads a page whole when Readability finds only a headline in it, or nothing", () => {
    const hidden = `<div hidden>${paragraph("Hidden.")}</div>`;
    expect(readPage(`<body>${hidden}<h1>Only the headline</h1></body>`).text).toMatch(
      /^Hidden\. .* Only the headline$/,
    );
    expect(readPage(`<body>${hidden}</body>`).text).toMatch(/^Hidden\. /);
  });
});

describe("excerpts", () => {
  const text = `${"a".repeat(50)} Pause AI ${"b".repeat(50)} PauseAI ${"c".repeat(300)} pause ai end`;

  it("cuts each passage at whole words", () => {
    // Cut through "Parliament", and at the space after "down".
    expect(excerpts("The march went past Parliament, where PauseAI spoke, and down Whitehall", /PauseAI/g, 16)).toEqual(
      ["where PauseAI spoke, and down"],
    );
    // Cut at the space before "two", and through "three".
    expect(excerpts("one two PauseAI three four", /PauseAI/g, 4)).toEqual(["two PauseAI"]);
  });

  it("gives the passage around each mention, joining ones that overlap", () => {
    const found = excerpts(text, /\bpause ?ai\b/gi, 60);
    expect(found).toHaveLength(2);
    // Each loses the run of c's it was cut through.
    expect(found[0]).toMatch(/^a+ Pause AI b+ PauseAI$/);
    expect(found[1]).toBe("pause ai end");
  });

  it("gives at most as many as asked, and none without a mention", () => {
    expect(excerpts(text, /\bpause ?ai\b/gi, 10, 1)).toHaveLength(1);
    expect(excerpts("nothing here", /\bpause ?ai\b/gi)).toEqual([]);
  });
});
