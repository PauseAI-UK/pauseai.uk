import { describe, expect, it } from "vitest";
import { PEOPLE } from "./config";
import { couldBeUs, ORG_NAMES, rank, readOrg, type Reading } from "./signals";

const org = (text: string) => readOrg(text, PEOPLE);

describe("readOrg", () => {
  it.each([
    ["Campaigners from PauseAI UK marched", "uk"],
    ["a volunteer with Pause AI's UK branch", "uk"],
    ["the UK chapter of Pause AI", "uk"],
    ["Joseph Miller of Pause AI said", "uk"],
    ["PauseAI Global's statement", "global"],
    ["see pauseai.info", "global"],
    ["Maxime Fournes, who runs PauseAI", "global"],
    ["PauseAI US held a rally", "us"],
    ["Pause AI (US) organisers", "us"],
    ["Holly Elmore of PauseAI", "us"],
    ["according to PauseAI.com", "lookalike"],
    ["the PauseAI chief warns", "unspecified"],
    ["activists from Pause AI gathered", "unspecified"],
    ["the Pause AI movement", "unspecified"],
    ["Meta to pause AI training", "phrase"],
    ["Teachers urge pause on AI use", "none"],
  ])("reads %j as %s", (text, expected) => {
    expect(org(text).org).toBe(expected);
  });

  it("doesn't take a name for us without a mention of Pause AI", () => {
    expect(org("Joseph Miller scored twice").org).toBe("none");
  });

  it("says which others the text names too", () => {
    expect(org("PauseAI UK and PauseAI US both protested; see pauseai.com")).toEqual({
      org: "uk",
      also: ["us", "lookalike"],
    });
  });
});

it("couldBeUs keeps UK, Global and unspecified coverage", () => {
  expect(Object.keys(ORG_NAMES).filter((name) => couldBeUs(name as never))).toEqual(["uk", "global", "unspecified"]);
});

it("rank puts who it's about first, then a UK outlet, copies and a page read", () => {
  const uk: Reading = { org: "uk", also: [] };
  expect(rank(uk, { uk: false, copies: 0, read: false })).toBe(10);
  expect(rank(uk, { uk: true, copies: 5, read: true })).toBe(17);
  expect(rank({ org: "us", also: [] }, { uk: true, copies: 0, read: false })).toBe(-8);
});
