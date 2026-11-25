import { describe, expect, it } from "vitest";
import { parseWidths, pictureName, WIDTHS, widthsPage } from "./widths.mjs";

describe("parseWidths", () => {
  it("takes the pages, and the widths, tables and link when given", () => {
    expect(parseWidths(["/staff/politicians", "/donate"])).toEqual({
      paths: ["/staff/politicians", "/donate"],
      widths: WIDTHS,
      tables: false,
      link: undefined,
    });
    expect(parseWidths(["/a", "--tables", "--widths", "1024,1440", "--link", "http://x:1/"])).toEqual({
      paths: ["/a"],
      widths: [1024, 1440],
      tables: true,
      link: "http://x:1/",
    });
  });

  it("refuses no page, a width that isn't one, and anything else", () => {
    expect(() => parseWidths([])).toThrow(/Name a page/);
    expect(() => parseWidths(["/a", "--widths", "wide"])).toThrow(/whole numbers/);
    expect(() => parseWidths(["/a", "--widths"])).toThrow(/whole numbers/);
    expect(() => parseWidths(["staff"])).toThrow(/Unknown argument staff/);
  });
});

describe("pictureName and widthsPage", () => {
  it("names a page's picture at a width, the home page as home", () => {
    expect(pictureName("/staff/sent-emails", 1440)).toBe("staff-sent-emails-1440.png");
    expect(pictureName("/", 390)).toBe("home-390.png");
  });

  it("sets each page's pictures in a row, with what was found under each, escaped", () => {
    const html = widthsPage(["/a"], [390, 1440], { "a-1440.png": ['table 1: "<Name>" wraps'] });
    expect(html).toContain("<h2>/a</h2>");
    expect(html).toContain('<img src="a-390.png" alt="/a at 390px"');
    expect(html).toContain('<li>table 1: "&lt;Name&gt;" wraps</li>');
    expect(html.match(/<ul>/g)).toHaveLength(1);
  });
});
