import { afterEach, expect, it, vi } from "vitest";
import { defineProblems } from "@/lib/problems";
import { inRun } from "@/lib/server/run-store.server";
import { orFallback } from "./fallback.server";
import { OutsideFailure } from "./outside-failure.server";

const problems = defineProblems("events", { lumaDown: "Luma couldn't be asked for the events" });

afterEach(() => vi.restoreAllMocks());

it("gives what the work gives when the service answers, reporting nothing", async () => {
  const outcome = await inRun(async (run) => ({
    events: await orFallback(problems.lumaDown(), [], async () => ["march"]),
    problems: run.problems,
  }));
  expect(outcome).toEqual({ events: ["march"], problems: [] });
});

it("gives the fallback when the service fails, reporting the failure", async () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const outcome = await inRun(async (run) => ({
    events: await orFallback(problems.lumaDown(), [], () =>
      Promise.reject(new OutsideFailure("luma", "refused", { status: 503 })),
    ),
    problems: run.problems,
  }));
  expect(outcome).toEqual({
    events: [],
    problems: [{ ...problems.lumaDown(), said: "Luma answered 503" }],
  });
});

it("throws on anything else, which is a bug of ours and not the service failing", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});
  const bug = new TypeError("Cannot read properties of undefined");
  await expect(orFallback(problems.lumaDown(), [], () => Promise.reject(bug))).rejects.toBe(bug);
  expect(logged).not.toHaveBeenCalled();
});
