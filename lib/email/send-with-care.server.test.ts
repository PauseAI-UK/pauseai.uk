import { afterEach, expect, it, vi } from "vitest";
import { defineProblems } from "@/lib/problems";
import { inRun } from "@/lib/server/run-store.server";
import { sendWithCare } from "./send-with-care.server";

const problems = defineProblems("posting", {
  notSentYet: (p: { letter: number }) => `Letter ${p.letter} couldn't be sent`,
  sentUnrecorded: (p: { letter: number }) => `Letter ${p.letter} went, unrecorded`,
});
const LETTER = {
  notSentYet: problems.notSentYet({ letter: 7 }),
  sentUnrecorded: problems.sentUnrecorded({ letter: 7 }),
};

afterEach(() => vi.restoreAllMocks());

/** Sends with care, in a run, with steps that note what was called: what it came to, the calls, and the run's problems. */
async function sending(steps: {
  send: () => Promise<{ went: string } | { unsent: string }>;
  record?: () => Promise<void>;
}) {
  vi.spyOn(console, "error").mockImplementation(() => {});
  const calls: string[] = [];
  return inRun(async (run) => {
    const result = await sendWithCare({
      problems: LETTER,
      send: steps.send,
      record: async (went) => {
        calls.push(`record ${went}`);
        await steps.record?.();
      },
      putBack: async () => {
        calls.push("put back");
        return "back in the queue";
      },
    });
    return { result, calls, problems: run.problems };
  });
}

it("records what went, and reports nothing", async () => {
  expect(await sending({ send: async () => ({ went: "message 1" }) })).toEqual({
    result: { sent: true, recorded: true },
    calls: ["record message 1"],
    problems: [],
  });
});

it("says what became of one that didn't go, without recording or reporting it", async () => {
  expect(await sending({ send: async () => ({ unsent: "held" }) })).toEqual({
    result: "held",
    calls: [],
    problems: [],
  });
});

it("puts back one whose sending threw, as nothing went, and reports it", async () => {
  const outcome = await sending({ send: () => Promise.reject(new Error("fetch failed")) });
  expect(outcome).toEqual({
    result: "back in the queue",
    calls: ["put back"],
    problems: [{ ...LETTER.notSentYet, said: "fetch failed" }],
  });
});

it("leaves one that went but couldn't be recorded as it was taken, and reports it", async () => {
  const outcome = await sending({
    send: async () => ({ went: "message 1" }),
    record: () => Promise.reject(new Error("no database")),
  });
  expect(outcome).toEqual({
    result: { sent: true, recorded: false },
    calls: ["record message 1"],
    problems: [{ ...LETTER.sentUnrecorded, said: "no database" }],
  });
});
