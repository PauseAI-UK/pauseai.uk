import { describe, expect, it } from "vitest";
import { ALL_ANSWERS, ASK_STATUSES, askSlug, asksAgreed, INVITED, isAnswer, standing } from "./asks";

describe("askSlug", () => {
  it("makes a slug of the title's letters and digits, then the date's month and year", () => {
    expect(askSlug("Go to Parliament", "2026-10-20")).toBe("go-to-parliament-oct-2026");
    expect(askSlug("  Réunion d'été! ", null)).toBe("reunion-d-ete");
    expect(askSlug("!!!", "2027-01-05")).toBe("ask-jan-2027");
  });
});

describe("asksAgreed", () => {
  it("counts the asks they signed or are going to, not another answer or a no", () => {
    const answers = { a: "signed", b: "going", c: "other", d: "declined" } as const;
    expect(asksAgreed(Object.fromEntries(Object.entries(answers).map(([ask, status]) => [ask, { status }])))).toBe(2);
    expect(asksAgreed({})).toBe(0);
    // Asked isn't agreed.
    expect(asksAgreed({ a: { status: INVITED } })).toBe(0);
  });
});

describe("standing", () => {
  it("is what's recorded, else invited when a letter put the ask to them, else nothing", () => {
    const person = {
      statuses: { answered: { status: "going" as const }, marked: { status: INVITED } },
      askedByLetter: { answered: new Date(), written: new Date() },
    };
    // An answer stands whatever letters went.
    expect(standing(person, "answered")).toBe("going");
    expect(standing(person, "marked")).toBe(INVITED);
    expect(standing(person, "written")).toBe(INVITED);
    expect(standing(person, "never")).toBeNull();
  });

  it("counts every status but invited as an answer, and nothing recorded as none", () => {
    expect(isAnswer("signed")).toBe(true);
    expect(isAnswer("other")).toBe(true);
    expect(isAnswer(INVITED)).toBe(false);
    expect(isAnswer(null)).toBe(false);
    expect(isAnswer(undefined)).toBe(false);
  });

  it("lists every answer any kind allows, once each", () => {
    expect([...ALL_ANSWERS].sort()).toEqual([...new Set(Object.values(ASK_STATUSES).flat())].sort());
  });
});
