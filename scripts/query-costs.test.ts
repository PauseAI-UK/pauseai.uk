import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { costReport, costTracker, costlyQueries, drain } from "./query-costs.mjs";

/** A plan as auto_explain logs it in JSON, each line of it after the first indented with a tab. */
function plan(query: string, cost: number) {
  const json = JSON.stringify({ "Query Text": query, Plan: { "Node Type": "Seq Scan", "Total Cost": cost } }, null, 2);
  return [`2026-11-25 00:00:00.000 UTC [1] LOG:  duration: 0.1 ms  plan:`, ...json.split("\n").map((l) => `\t${l}`)]
    .map((line) => `${line}\n`)
    .join("");
}

const log = [
  plan("SELECT 1", 5),
  plan("SELECT *\n  FROM supporters_listed", 150_000),
  "2026-11-25 00:00:00.000 UTC [1] LOG:  some other line\n",
  plan("SELECT * FROM supporters_listed", 120_000),
  plan("SELECT * FROM letters", 101_000),
  "2026-11-25 00:00:00.000 UTC [1] LOG:  duration: 0.1 ms  plan:\n\t{ not json\n",
].join("");

describe("costlyQueries", () => {
  it("finds each query priced over the threshold, the most it cost, highest first, passing over a plan it can't read", () => {
    expect(costlyQueries(log)).toEqual([
      { query: "SELECT * FROM supporters_listed", cost: 150_000 },
      { query: "SELECT * FROM letters", cost: 101_000 },
    ]);
    expect(costlyQueries(log, 200_000)).toEqual([]);
  });
});

describe("costTracker", () => {
  it("finds the same however the log is cut into pieces, a plan split between two put back together", () => {
    for (const size of [7, 50, 333, log.length]) {
      const tracker = costTracker();
      for (let at = 0; at < log.length; at += size) tracker.add(log.slice(at, at + size));
      expect(tracker.found()).toEqual(costlyQueries(log));
    }
  });
});

describe("costReport", () => {
  it("lists each, or says there's none", () => {
    expect(costReport([{ query: "SELECT 1", cost: 123_456.7 }])).toBe(
      "Priced over 100,000, the most each cost:\n  123,457  SELECT 1",
    );
    expect(costReport([])).toBe("No query the tests ran is priced over 100,000.");
  });
});

describe("drain", () => {
  it("hands over whole lines as the file grows, emptying it, and the rest once stopped", async () => {
    const dir = mkdtempSync(join(tmpdir(), "query-costs-"));
    const file = join(dir, "log");
    writeFileSync(file, "one\ntw");
    const taken: string[] = [];
    const stop = drain(file, (text: string) => taken.push(text), 10);
    await new Promise((resolve) => setTimeout(resolve, 50));
    appendFileSync(file, "o\nthree");
    await new Promise((resolve) => setTimeout(resolve, 50));
    stop();
    expect(taken.join("")).toBe("one\ntwo\nthree");
    expect(taken.at(-1)).toBe("three");
    rmSync(dir, { recursive: true, force: true });
  });
});
