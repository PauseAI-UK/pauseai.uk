import { describe, expect, it } from "vitest";
import { cleanUrl, hostOf, linksIn, urlKey } from "./urls";

describe("cleanUrl", () => {
  it("drops tracking parameters and the fragment, keeping the rest", () => {
    expect(cleanUrl("https://www.example.com/news/a?utm_source=x&UTM_medium=y&fbclid=1&page=2#comments")).toBe(
      "https://www.example.com/news/a?page=2",
    );
  });

  it("takes an AMP copy back to the article", () => {
    expect(cleanUrl("https://amp.example.com/news/a/amp")).toBe("https://example.com/news/a");
    expect(cleanUrl("https://example.com/news/a.amp")).toBe("https://example.com/news/a");
    expect(cleanUrl("https://example.com/amp/news/a")).toBe("https://example.com/news/a");
    expect(cleanUrl("https://example.com/news/a?outputType=amp")).toBe("https://example.com/news/a");
    expect(cleanUrl("https://example.com/news/a?outputType=print")).toBe("https://example.com/news/a?outputType=print");
    expect(cleanUrl("https://example.com/amp")).toBe("https://example.com/");
  });

  it("refuses what isn't an http(s) link", () => {
    expect(cleanUrl("not a link")).toBeUndefined();
    expect(cleanUrl("javascript:alert(1)")).toBeUndefined();
  });
});

describe("urlKey", () => {
  it("is the same for two links to one article", () => {
    expect(urlKey("http://www.Example.com/news/a/?b=2&a=1&utm_campaign=z")).toBe(
      urlKey("https://example.com/news/a?a=1&b=2"),
    );
  });

  it("is undefined for what isn't a link", () => {
    expect(urlKey("mailto:jane.smith@example.com")).toBeUndefined();
  });
});

it("hostOf gives the site without www.", () => {
  expect(hostOf("https://WWW.example.co.uk/a")).toBe("example.co.uk");
});

it("linksIn finds every link in text, in strings and comments alike", () => {
  const text = `url: "https://example.com/a?utm_source=x", // see https://www.example.org/b) and http://[broken`;
  expect([...linksIn(text)]).toEqual(["example.com/a", "example.org/b"]);
});
