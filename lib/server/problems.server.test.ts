import { afterEach, expect, it, vi } from "vitest";
import { defineProblems, type ReportedProblem } from "@/lib/problems";
import { OutsideFailure } from "./outside-services/outside-failure.server";
import { describeError, keptError, note, problem, registerProblemKeeper } from "./problems.server";
import { currentRun, inRun } from "./run-store.server";

const letters = defineProblems("letters", {
  notSent: (p: { letter: number }) => `Letter ${p.letter} couldn't be sent`,
  noInbox: "The letters inbox isn't set",
  inRun: (p: { run: "a" | "b" }) => `In run ${p.run}`,
});

afterEach(() => {
  vi.restoreAllMocks();
  registerProblemKeeper(undefined);
});

it("hands a problem outside a run to what keeps errors, but not one staff were told of already", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const kept: ReportedProblem[] = [];
  registerProblemKeeper((reported) => kept.push(reported));
  problem(letters.notSent({ letter: 12 }), new Error("no database"));
  problem(letters.noInbox());
  problem(letters.noInbox(), undefined, { told: true });
  await inRun(async () => problem(letters.noInbox()));
  expect(kept).toEqual([
    { code: "letters.notSent", values: { letter: 12 }, what: "Letter 12 couldn't be sent", said: "no database" },
    { code: "letters.noInbox", values: {}, what: "The letters inbox isn't set" },
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

it("notes an error in words, with what caused it, and anything else as it is", () => {
  const logged = vi.spyOn(console, "info").mockImplementation(() => {});
  note("The connection dropped", new Error("fetch failed", { cause: new Error("timeout") }), 3, "times");
  note("Nothing to record");
  expect(logged.mock.calls).toEqual([
    ["The connection dropped", "fetch failed (timeout)", 3, "times"],
    ["Nothing to record"],
  ]);
});

it("keeps an outside service's failure with its service, kind, status and code, and any other error by its words", () => {
  const limited = new OutsideFailure("luma", "rate-limited", { status: 429, said: "Slow down", asked: "/v1/events" });
  expect(keptError(limited)).toEqual({
    said: "Luma answered 429 for /v1/events: Slow down",
    service: "luma",
    kind: "rate-limited",
    status: 429,
  });
  // As a column takes it: a failure without a code of the service's own has none.
  expect(JSON.parse(JSON.stringify(keptError(limited)))).toEqual({
    said: "Luma answered 429 for /v1/events: Slow down",
    service: "luma",
    kind: "rate-limited",
    status: 429,
  });
  const inactive = new OutsideFailure("postmark", "refused", { status: 422, serviceCode: 406 });
  expect(keptError(inactive)).toEqual({
    said: "Postmark answered 422",
    service: "postmark",
    kind: "refused",
    status: 422,
    serviceCode: 406,
  });
  const down = new OutsideFailure("civicrm", "unreachable", { cause: new Error("fetch failed") });
  expect(keptError(down)).toEqual({
    said: "CiviCRM couldn't be reached (fetch failed)",
    service: "civicrm",
    kind: "unreachable",
    status: 0,
  });
  expect(keptError(new Error("boom", { cause: new Error("why") }))).toEqual({ said: "boom (why)" });
  expect(keptError("not an Error")).toEqual({ said: "not an Error" });
});

it("keeps a problem on the run in progress, across awaits, and only logs one outside a run", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  expect(currentRun()).toBeUndefined();
  problem(letters.notSent({ letter: 3 }), new Error("outside"));
  expect(logged).toHaveBeenCalledWith("Letter 3 couldn't be sent", "outside");
  const kept = await inRun(async (run) => {
    problem(letters.noInbox());
    expect(currentRun()).toBe(run);
    await Promise.resolve();
    problem(letters.notSent({ letter: 4 }));
    return run.problems;
  });
  expect(kept.map((p) => p.what)).toEqual(["The letters inbox isn't set", "Letter 4 couldn't be sent"]);
  expect(currentRun()).toBeUndefined();
});

it("keeps two runs at once apart", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const [a, b] = await Promise.all([
    inRun(async (run) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      problem(letters.inRun({ run: "a" }));
      return run.problems.map((p) => p.what);
    }),
    inRun(async (run) => {
      problem(letters.inRun({ run: "b" }));
      await new Promise((resolve) => setTimeout(resolve, 10));
      return run.problems.map((p) => p.what);
    }),
  ]);
  expect(a).toEqual(["In run a"]);
  expect(b).toEqual(["In run b"]);
});
