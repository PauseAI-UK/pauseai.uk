import { expect, it } from "vitest";
import { defineProblems, outsideId, problemKey, problemSaid, publicText, type SafeText } from "./problems";

const problems = defineProblems("posting", {
  noInbox: "Nobody was emailed",
  notSent: (p: { letter: number }) => `Letter ${p.letter} couldn't be sent`,
  refused: (p: { purpose: "letter" | "relay"; again: boolean }) => `A ${p.purpose} was refused (${p.again})`,
  misspelt: (p: { mp: SafeText; events: readonly SafeText[]; rows: number[] }) =>
    `${p.mp}: ${p.events.join(", ")} on rows ${p.rows.join(", ")}`,
});

it("makes each declared problem a function that says it happened, by its code, values and sentence", () => {
  expect(problems.noInbox()).toEqual({ code: "posting.noInbox", values: {}, what: "Nobody was emailed" });
  expect(problems.notSent({ letter: 4127 })).toEqual({
    code: "posting.notSent",
    values: { letter: 4127 },
    what: "Letter 4127 couldn't be sent",
  });
  expect(problems.refused({ purpose: "relay", again: true }).what).toBe("A relay was refused (true)");
  expect(problems.misspelt({ mp: publicText("Jane Smith MP"), events: [outsideId("evt-1")], rows: [2, 3] })).toEqual({
    code: "posting.misspelt",
    values: { mp: "Jane Smith MP", events: ["evt-1"], rows: [2, 3] },
    what: "Jane Smith MP: evt-1 on rows 2, 3",
  });
});

it("refuses values that could hold plain text, which is what a name or an address is", () => {
  // @ts-expect-error -- a letter is a number
  problems.notSent({ letter: "4127" });
  // @ts-expect-error -- text goes through publicText() or outsideId()
  problems.misspelt({ mp: "Jane Smith MP", events: [], rows: [] });
  // @ts-expect-error -- a problem with values is handed them
  problems.notSent();
  // @ts-expect-error -- plain text
  defineProblems("posting", { bad: (p: { to: string }) => p.to });
  // @ts-expect-error -- a list of plain text
  defineProblems("posting", { bad: (p: { to: string[] }) => p.to.join() });
  // @ts-expect-error -- an object, whose fields nothing checks
  defineProblems("posting", { bad: (p: { to: { id: number } }) => String(p.to.id) });
  // @ts-expect-error -- one with no values is a sentence as it stands
  defineProblems("posting", { bad: () => "Nothing varies" });
});

it("knows a kept problem by its code, or by its sentence if it was kept before problems had codes", () => {
  expect(problemKey({ code: "posting.notSent", values: { letter: 1 }, what: "Letter 1 couldn't be sent" })).toBe(
    "posting.notSent",
  );
  expect(problemKey({ what: "Letter 1 couldn't be sent" })).toBe("Letter 1 couldn't be sent");
});

it("gives the error's words kept with a problem, whichever way it was kept", () => {
  expect(problemSaid({ code: "posting.notSent", what: "x", said: "fetch failed" })).toBe("fetch failed");
  expect(problemSaid({ what: "x", error: "Gmail answered 503" })).toBe("Gmail answered 503");
  expect(problemSaid({ what: "x" })).toBeUndefined();
});
