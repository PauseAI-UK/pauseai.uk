import { describe, expect, it } from "vitest";
import { filtersPath, pageNumber, pageParam, pagePath } from "./list-params";

describe("pageNumber", () => {
  it("reads a page from 1, or the first page", () => {
    expect(pageNumber("3")).toBe(3);
    for (const page of ["0", "x", "", undefined]) expect(pageNumber(page)).toBe(1);
  });
});

describe("pageParam", () => {
  it("is the page's number in a list's URL, and nothing for the first", () => {
    expect(pageParam(2)).toEqual({ page: "2" });
    expect(pageParam(1)).toEqual({ page: "" });
  });
});

describe("filtersPath", () => {
  it("keeps the filters given, with the changes, and leaves out the blank ones", () => {
    expect(filtersPath("/staff/politicians", { q: "jo", house: "lords", party: "" }, { house: "" })).toBe(
      "/staff/politicians?q=jo",
    );
    expect(filtersPath("/staff/politicians", { q: "jo" }, { status: "any" })).toBe(
      "/staff/politicians?q=jo&status=any",
    );
    expect(filtersPath("/staff/politicians", {})).toBe("/staff/politicians");
  });
});

describe("pagePath", () => {
  it("gives the first page at the list's own URL, and any other with its number", () => {
    expect(pagePath("/staff/audit-log", 1)).toBe("/staff/audit-log");
    expect(pagePath("/staff/audit-log", 2)).toBe("/staff/audit-log?page=2");
  });
});
