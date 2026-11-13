import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodeEntities, gdeltUrl, googleNewsUrl, readGdelt, readGoogleNews } from "./sources";

const sample = (name: string) => readFileSync(join(__dirname, "samples", name), "utf8");

describe("GDELT", () => {
  it("asks for up to 250 articles of the last week as JSON", () => {
    const url = new URL(gdeltUrl('"Pause AI" sourcecountry:UK'));
    expect(url.origin + url.pathname).toBe("https://api.gdeltproject.org/api/v2/doc/doc");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      query: '"Pause AI" sourcecountry:UK',
      mode: "artlist",
      format: "json",
      maxrecords: "250",
      timespan: "7d",
    });
  });

  it("reads a stored answer", () => {
    const { leads, error } = readGdelt(sample("gdelt.json"));
    expect(error).toBeUndefined();
    expect(leads).toHaveLength(10);
    expect(leads[6]).toEqual({
      title: "California teachers urge 3 - year pause on AI use in K - 8 schools",
      url: expect.stringMatching(/^https:\/\/www\.pressdemocrat\.com\//),
      direct: true,
      domain: "pressdemocrat.com",
      date: "2026-11-12",
      country: "United States",
      source: "GDELT",
    });
  });

  it("reads no articles as none", () => {
    expect(readGdelt("{}")).toEqual({ leads: [] });
  });

  it("skips an article with no usable link or date", () => {
    const body = JSON.stringify({
      articles: [
        { url: "ftp://example.com/a", title: "A", seendate: "20261110T000000Z", domain: "example.com" },
        { url: "https://www.example.com/b", title: " B\n", seendate: "", domain: "WWW.Example.com", sourcecountry: "" },
      ],
    });
    expect(readGdelt(body).leads).toEqual([
      { title: "B", url: "https://www.example.com/b", direct: true, domain: "example.com", source: "GDELT" },
    ]);
  });

  it("says what's wrong when the answer is a line of text, as it is when asked too often", () => {
    expect(readGdelt(sample("gdelt-429.txt"))).toEqual({
      leads: [],
      error: "Please limit requests to one every 5 seconds or contact us for larger queries.",
    });
    expect(readGdelt("  ").error).toBe("an empty answer");
  });
});

describe("Google News", () => {
  it("searches in British English", () => {
    const url = new URL(googleNewsUrl('"PauseAI" when:7d'));
    expect(url.origin + url.pathname).toBe("https://news.google.com/rss/search");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: '"PauseAI" when:7d',
      hl: "en-GB",
      gl: "GB",
      ceid: "GB:en",
    });
  });

  it("reads a stored answer, taking the outlet off each title", () => {
    const { leads, error } = readGoogleNews(sample("google-news.xml"));
    expect(error).toBeUndefined();
    expect(leads).toHaveLength(9);
    expect(leads[0]).toEqual({
      title: "INTERVIEW - AI could unleash global cyber catastrophe within months, PauseAI chief warns",
      url: expect.stringMatching(/^https:\/\/news\.google\.com\/rss\/articles\//),
      direct: false,
      domain: "aa.com.tr",
      outlet: "Anadolu Ajansı",
      date: "2026-11-09",
      source: "Google News",
    });
  });

  it("copes with an item missing its source, date or link", () => {
    const xml = `<rss><channel>
      <item><title><![CDATA[Pause AI &amp; more]]></title><link>https://news.google.com/rss/articles/x</link></item>
      <item><title>Odd</title><link>https://news.google.com/rss/articles/y</link><pubDate>not a date</pubDate><source>Odd Times</source></item>
      <item><title>No link</title></item>
      <item><link>https://news.google.com/rss/articles/z</link></item>
    </channel></rss>`;
    expect(readGoogleNews(xml).leads.at(-1)?.title).toBe("");
    expect(readGoogleNews(xml).leads.slice(0, 2)).toEqual([
      {
        title: "Pause AI & more",
        url: "https://news.google.com/rss/articles/x",
        direct: false,
        domain: "news.google.com",
        source: "Google News",
      },
      {
        title: "Odd",
        url: "https://news.google.com/rss/articles/y",
        direct: false,
        domain: "news.google.com",
        outlet: "Odd Times",
        source: "Google News",
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
