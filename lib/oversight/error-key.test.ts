import { describe, expect, it } from "vitest";
import { isBrowserKind, steadyPath, steadyWords } from "./error-key";

describe("an error's steady words", () => {
  it("are the same for two happenings that differ by a number", () => {
    expect(steadyWords("No politician 4127")).toBe("No politician <n>");
    expect(steadyWords("No politician 4128")).toBe(steadyWords("No politician 4127"));
  });

  it("stand for a URL and an email address before the numbers in them", () => {
    expect(steadyWords("fetch https://api.example.org/v1/events?page=2 failed for jane.smith@example.com")).toBe(
      "fetch <url> failed for <email>",
    );
  });

  it("stand for anything quoted, but not an apostrophe inside a word", () => {
    expect(steadyWords(`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`)).toBe(
      "Unexpected token <text>, <text>... is not valid JSON",
    );
    expect(steadyWords("Couldn't read “Jane's letter” or `draft`")).toBe("Couldn't read <text> or <text>");
  });

  it("stand for a UUID and a long hex ID, leaving a word that only looks like hex", () => {
    expect(steadyWords("Session 3f2b8c1a-9d4e-4a6b-8c2d-1e5f7a9b0c3d of 0a1b2c3d4e5f gone, defaced")).toBe(
      "Session <id> of <id> gone, defaced",
    );
  });

  it("are on one line, and cut short", () => {
    expect(steadyWords("  one\n  two  ")).toBe("one two");
    expect(steadyWords("x".repeat(500))).toHaveLength(300);
  });
});

describe("a page's steady path", () => {
  it("stands for a part that's a number or an ID, and drops the query", () => {
    expect(steadyPath("/staff/politicians/4127?tab=letters#notes")).toBe("/staff/politicians/<n>");
    expect(steadyPath("/staff/api/callback/9f8e7d6c")).toBe("/staff/api/callback/<id>");
    expect(steadyPath(`/blog/${"a".repeat(41)}`)).toBe("/blog/<id>");
    expect(steadyPath("/campaigns/J%C3%A1ne")).toBe("/campaigns/<id>");
  });

  it("keeps a path of words as it is, cut short", () => {
    expect(steadyPath("/campaigns/support-sobel-bill")).toBe("/campaigns/support-sobel-bill");
    expect(steadyPath("/")).toBe("/");
    expect(steadyPath(`/${"ab/".repeat(100)}`)).toHaveLength(200);
  });
});

it("knows the browser's kinds", () => {
  expect(isBrowserKind("browser-page")).toBe(true);
  expect(isBrowserKind("browser-other")).toBe(true);
  expect(isBrowserKind("render")).toBe(false);
  expect(isBrowserKind(undefined)).toBe(false);
});
