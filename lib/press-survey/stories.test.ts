import { describe, expect, it } from "vitest";
import type { Lead } from "./sources";
import { isUk, stories, titleKey } from "./stories";
import { urlKey } from "./urls";

const lead = (fields: Partial<Lead>): Lead => ({
  title: "Protesters march on Whitehall",
  url: "https://example.com/a",
  direct: true,
  domain: "example.com",
  source: "GDELT",
  ...fields,
});

it("titleKey matches headlines across punctuation, case, accents and an outlet's name", () => {
  expect(titleKey("Protesters MARCH on Whitehall! - The Example Gazette")).toBe("protesters march on whitehall");
  expect(titleKey("Protesters march on Whitehall | Gazette")).toBe("protesters march on whitehall");
  expect(titleKey("Manifestação em Londres")).toBe("manifestacao em londres");
});

it("isUk goes by GDELT's country, or a .uk domain", () => {
  expect(isUk(lead({ country: "United Kingdom" }))).toBe(true);
  expect(isUk(lead({ domain: "example.co.uk" }))).toBe(true);
  expect(isUk(lead({ country: "United States" }))).toBe(false);
});

describe("stories", () => {
  it("joins one article found twice, and one story from two outlets", () => {
    const first = lead({ url: "https://example.com/a?utm_source=x" });
    const again = lead({ url: "https://www.example.com/a" });
    const copy = lead({ url: "https://example.org/b", title: "Protesters march on Whitehall - Example Org" });
    const other = lead({ url: "https://example.net/c", title: "Something else" });
    expect(stories([first, again, copy, other], new Set())).toEqual([
      { lead: first, others: [copy] },
      { lead: other, others: [] },
    ]);
  });

  it("judges a story on a direct link from a UK outlet first, then any direct link", () => {
    const google = lead({ url: "https://news.google.com/rss/articles/x", direct: false, source: "Google News" });
    const us = lead({ url: "https://example.com/us" });
    const uk = lead({ url: "https://example.co.uk/uk", domain: "example.co.uk" });
    expect(stories([google, us, uk], new Set())[0].lead).toBe(uk);
    expect(stories([google, us], new Set())[0].lead).toBe(us);
    expect(stories([google], new Set())[0].lead).toBe(google);
  });

  it("leaves out a story any copy of which is already known", () => {
    const known = new Set([urlKey("https://example.org/b") as string]);
    const leads = [lead({}), lead({ url: "https://example.org/b" }), lead({ url: "https://example.net/c", title: "" })];
    expect(stories(leads, known)).toEqual([{ lead: leads[2], others: [] }]);
  });
});
