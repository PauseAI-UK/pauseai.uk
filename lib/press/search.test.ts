import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeEntities, inWindow, readGoogleNews, windows } from "./search";

const sample = (name: string) => readFileSync(join(__dirname, "samples", name), "utf8");

describe("windows", () => {
  it("covers the days since the search last reached, a week at a time, each overlapping the next by a day", () => {
    expect(windows("2026-10-07", "2026-10-22")).toEqual([
      { after: "2026-10-07", before: "2026-10-15" },
      { after: "2026-10-14", before: "2026-10-22" },
      { after: "2026-10-21", before: "2026-10-23" },
    ]);
    expect(inWindow('"PauseAI"', { after: "2026-10-07", before: "2026-10-15" })).toBe(
      '"PauseAI" after:2026-10-07 before:2026-10-15',
    );
  });

  it("has nothing to search when it reached today", () => {
    expect(windows("2026-10-22", "2026-10-22")).toEqual([]);
  });
});

describe("readGoogleNews", () => {
  it("reads a stored answer, taking the outlet off each title", () => {
    const { found, error } = readGoogleNews(sample("google-news.xml"));
    expect(error).toBeUndefined();
    expect(found).toHaveLength(9);
    expect(found[0]).toEqual({
      title: "INTERVIEW - AI could unleash global cyber catastrophe within months, PauseAI chief warns",
      googleLink: expect.stringMatching(/^https:\/\/news\.google\.com\/rss\/articles\//),
      domain: "aa.com.tr",
      outlet: "Anadolu Ajansı",
      date: "2026-11-09",
    });
  });

  it("copes with an item missing its source, date or link", () => {
    const xml = `<rss><channel>
      <item><title><![CDATA[Pause AI &amp; more]]></title><link>https://news.google.com/rss/articles/x</link></item>
      <item><title>Odd</title><link>https://news.google.com/rss/articles/y</link><pubDate>not a date</pubDate><source>Odd Times</source></item>
      <item><title>No link</title></item>
      <item><link>https://news.google.com/rss/articles/z</link></item>
    </channel></rss>`;
    expect(readGoogleNews(xml).found.at(-1)?.title).toBe("");
    expect(readGoogleNews(xml).found.slice(0, 2)).toEqual([
      { title: "Pause AI & more", googleLink: "https://news.google.com/rss/articles/x", domain: "news.google.com" },
      {
        title: "Odd",
        googleLink: "https://news.google.com/rss/articles/y",
        domain: "news.google.com",
        outlet: "Odd Times",
      },
    ]);
  });

  it("says what's wrong when the answer isn't a feed", () => {
    expect(readGoogleNews("<html>Too many requests</html>").error).toBe("<html>Too many requests</html>");
    expect(readGoogleNews("").error).toBe("an empty answer");
  });
});

it("decodeEntities reads named and numbered references, and leaves unknown ones", () => {
  expect(decodeEntities("&lt;b&gt; &#39;a&#x27; &ldquo;q&rdquo; &AMP; &bogus;")).toBe("<b> 'a' “q” & &bogus;");
});
