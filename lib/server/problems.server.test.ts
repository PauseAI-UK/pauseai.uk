import { afterEach, expect, it, vi } from "vitest";
import { defineProblems, type Problem } from "@/lib/problems";
import { describeError, problem, problemInWords, registerProblemKeeper } from "./problems.server";
import { currentRun, inRun } from "./run-store.server";

const letters = defineProblems("letters", {
  notSent: (p: { letter: number }) => `Letter ${p.letter} couldn't be sent`,
  noInbox: "The letters inbox isn't set",
});

afterEach(() => {
  vi.restoreAllMocks();
  registerProblemKeeper(undefined);
});

it("hands a problem outside a run to what keeps errors, but not one staff were told of already", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const kept: Problem[] = [];
  registerProblemKeeper((reported) => kept.push(reported));
  problem(letters.notSent({ letter: 12 }), new Error("no database"));
  problem(letters.noInbox());
  problem(letters.noInbox(), undefined, { told: true });
  problemInWords("A letter couldn't be kept", new Error("no database"));
  problemInWords("A note with no error");
  problemInWords("Told by an alert of its own", undefined, { told: true });
  await inRun(async () => problem(letters.noInbox()));
  await inRun(async () => problemInWords("The run keeps this one"));
  expect(kept).toEqual([
    { code: "letters.notSent", values: { letter: 12 }, what: "Letter 12 couldn't be sent", said: "no database" },
    { code: "letters.noInbox", values: {}, what: "The letters inbox isn't set" },
    { what: "A letter couldn't be kept", error: "no database" },
    { what: "A note with no error" },
  ]);
});

it("keeps a declared problem on the run by its code, values and sentence, with the error's words", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const kept = await inRun(async (run) => {
    problem(letters.notSent({ letter: 4127 }), new Error("fetch failed", { cause: new Error("timeout") }));
    problem(letters.noInbox());
    problem(letters.noInbox(), undefined, { told: true });
    return run.problems;
  });
  expect(kept).toEqual([
    {
      code: "letters.notSent",
      values: { letter: 4127 },
      what: "Letter 4127 couldn't be sent",
      said: "fetch failed (timeout)",
    },
    { code: "letters.noInbox", values: {}, what: "The letters inbox isn't set" },
    { code: "letters.noInbox", values: {}, what: "The letters inbox isn't set", told: true },
  ]);
  expect(logged.mock.calls).toEqual([
    ["Letter 4127 couldn't be sent", "fetch failed (timeout)"],
    ["The letters inbox isn't set"],
    ["The letters inbox isn't set"],
  ]);
});

it("describes an error with what caused it, a few deep, and anything else as it is", () => {
  const refused = new Error("connect ECONNREFUSED");
  const failed = new Error("fetch failed", { cause: refused });
  expect(describeError(failed)).toBe("fetch failed (connect ECONNREFUSED)");
  expect(describeError(new Error("plain"))).toBe("plain");
  expect(describeError(new Error("", { cause: "a string" }))).toBe("Error (a string)");
  expect(describeError("not an Error")).toBe("not an Error");
  expect(describeError(42)).toBe("42");
  let deep: Error = new Error("bottom");
  for (let i = 0; i < 6; i++) deep = new Error(`level ${i}`, { cause: deep });
  expect(describeError(deep)).toBe("level 5 (level 4) (level 3) (level 2) (level 1)");
  const nameless = new Error("", { cause: new Error("") });
  expect(describeError(nameless)).toBe("Error (Error)");
});

it("keeps a problem on the run in progress, and only logs one outside a run", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(currentRun()).toBeUndefined();
  problemInWords("Nothing to keep it on", new Error("outside"));
  expect(logged).toHaveBeenCalledWith("Nothing to keep it on", "outside");
  const kept = await inRun(async (run) => {
    problemInWords("Luma wouldn't give an event", new Error("Luma answered 503", { cause: new Error("timeout") }));
    problemInWords("A note with no error");
    problemInWords("Told by an alert of its own", undefined, { told: true });
    expect(currentRun()).toBe(run);
    await Promise.resolve();
    problemInWords("Still the same run after an await");
    return run.problems;
  });
  expect(kept).toEqual([
    { what: "Luma wouldn't give an event", error: "Luma answered 503 (timeout)" },
    { what: "A note with no error" },
    { what: "Told by an alert of its own", told: true },
    { what: "Still the same run after an await" },
  ]);
  expect(logged).toHaveBeenCalledWith("A note with no error");
  expect(currentRun()).toBeUndefined();
});

it("keeps two runs at once apart", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const [a, b] = await Promise.all([
    inRun(async (run) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      problemInWords("in a");
      return run.problems.map((p) => p.what);
    }),
    inRun(async (run) => {
      problemInWords("in b");
      await new Promise((resolve) => setTimeout(resolve, 10));
      return run.problems.map((p) => p.what);
    }),
  ]);
  expect(a).toEqual(["in a"]);
  expect(b).toEqual(["in b"]);
});
