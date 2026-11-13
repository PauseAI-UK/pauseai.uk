import { describe, expect, it } from "vitest";
import {
  exampleFailedRun,
  exampleGmailResult,
  exampleCivicrmResult,
  exampleLumaResult,
  exampleRun,
} from "@/app/(staff)/staff/_components/RunList.examples";
import type { AnyImportRun } from "./import-runs";
import { runLog, runShape, tabled } from "./run-log";

const AT = new Date("2026-11-03T12:00:00Z");
const luma = (id: number, extra = {}, at = AT) =>
  exampleRun("import-luma", { ...exampleLumaResult, ...extra }, { id, at });
const stopped = { stoppedBy: "time" as const };
/** A read of Gmail: a row, or whole, and green, if it searched again. */
const gmail = (id: number, a: object = {}) =>
  exampleRun(
    "read-gmail",
    { accounts: [{ ...exampleGmailResult.accounts[0], error: undefined, notUnderstood: undefined, ...a }] },
    { id, at: AT },
  );
const quietLuma = (id: number, at = AT) =>
  exampleRun("import-luma", exampleLumaResult, { id, at, status: "unchanged" });
const flat = (days: ReturnType<typeof runLog>) => days.flatMap((d) => d.entries);
const shapes = (days: ReturnType<typeof runLog>) => flat(days).map((e) => [e.shape, e.runs.length]);

describe("how a run shows", () => {
  it("is in a table of the day's runs on a job that runs every 5 minutes or hourly, and whole otherwise", () => {
    expect(tabled("import-luma")).toBe(true);
    expect(tabled("import-civicrm")).toBe(true);
    expect(tabled("check-mps")).toBe(false);
    expect(tabled("tidy-logs")).toBe(false);
  });

  it("is whole for a job that runs rarely, whatever it did", () => {
    const check = exampleRun("check-mps", { problems: [] }, { status: "unchanged" });
    expect(runShape(check)).toBe("run");
    expect(runShape(exampleFailedRun("tidy-logs", "boom", {}))).toBe("run");
  });

  it("is a line when a frequent or hourly job found nothing, unless it stopped short", () => {
    expect(runShape(quietLuma(1))).toBe("quiet");
    expect(runShape(exampleRun("import-civicrm", exampleCivicrmResult, { status: "unchanged" }))).toBe("quiet");
    const stopped = exampleRun(
      "import-luma",
      { ...exampleLumaResult, stoppedBy: "time" as const },
      { status: "unchanged" },
    );
    expect(runShape(stopped)).toBe("run");
  });

  it("is whole for a failure, and for an hourly job that found something", () => {
    expect(runShape(exampleFailedRun("import-luma", "boom", {}))).toBe("run");
    expect(runShape(exampleRun("import-civicrm", exampleCivicrmResult, {}))).toBe("run");
  });

  it("is a row for Luma's ordinary run, and whole for one that stopped short", () => {
    expect(runShape(exampleRun("import-luma", exampleLumaResult, {}))).toBe("rows");
    expect(runShape(exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "time" as const }, {}))).toBe("run");
  });

  it("is a row for an ordinary read of Gmail, and whole for one with problems or that searched again", () => {
    expect(runShape(gmail(1))).toBe("rows");
    // An account it couldn't read is a problem of the run, which shows whole.
    expect(runShape(gmail(1, { error: "403" }))).toBe("rows");
    expect(
      runShape(exampleRun("read-gmail", { accounts: [] }, { problems: [{ what: "al@pauseai.uk couldn't be read" }] })),
    ).toBe("run");
    expect(runShape(gmail(1, { restarted: true }))).toBe("run");
  });
});

describe("a job's page", () => {
  it("has the newest whole, tinted and current, then rows and lines gathered, under each day", () => {
    const days = runLog(
      [luma(5, stopped), luma(4), luma(3), quietLuma(2), quietLuma(1, new Date("2026-11-02T12:00:00Z"))],
      false,
    );
    expect(shapes(days)).toEqual([
      ["run", 1],
      ["rows", 2],
      ["quiet", 1],
      ["quiet", 1],
    ]);
    expect(days.map((d) => [d.day, d.entries.length])).toEqual([
      ["3 Nov 2026", 3],
      ["2 Nov 2026", 1],
    ]);
    expect(days[0].entries[0]).toMatchObject({ tone: "amber", open: true, current: true });
    expect(
      flat(days)
        .slice(1)
        .every((e) => e.current === undefined),
    ).toBe(true);
  });

  it("keeps a frequent job's problems tinted further down, but not a rare job's or a good one", () => {
    const runs: AnyImportRun[] = [
      luma(4),
      luma(3, stopped),
      exampleFailedRun("read-gmail", "boom", { id: 2 }),
      gmail(1, { restarted: true }),
    ];
    expect(flat(runLog(runs, false)).map((e) => e.tone)).toEqual(["green", "amber", "red", undefined]);
    const rare = [exampleRun("check-mps", { problems: [] }, {}), exampleFailedRun("check-mps", "boom", { id: 2 })];
    expect(flat(runLog(rare, false)).map((e) => e.tone)).toEqual(["green", undefined]);
  });

  it("treats the newest as an older one while a press runs", () => {
    const [first, second] = flat(runLog([luma(2, stopped), luma(1)], true));
    expect(first).toMatchObject({ shape: "run", tone: undefined, open: undefined });
    expect(first.current).toBeUndefined();
    expect(second.shape).toBe("rows");
  });

  it("folds whole runs past the newest few, and rows past the most recent", () => {
    const whole = [1, 2, 3, 4, 5, 6].map((id) => exampleRun("check-mps", { problems: [] }, { id }));
    expect(flat(runLog(whole, false)).map((e) => e.open)).toEqual([
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    ]);
    const rows = Array.from({ length: 20 }, (_, id) => luma(id));
    const entries = runLog(rows, false);
    expect(shapes(entries)).toEqual([
      ["run", 1],
      ["rows", 12],
      ["rows", 7],
    ]);
    expect(flat(entries).map((e) => e.folded)).toEqual([undefined, false, true]);
  });

  it("doesn't gather rows across a run shown whole, or of different jobs", () => {
    const entries = runLog([luma(5), luma(4), luma(3, stopped), luma(2), gmail(9)], false);
    expect(shapes(entries)).toEqual([
      ["run", 1],
      ["rows", 1],
      ["run", 1],
      ["rows", 1],
      ["rows", 1],
    ]);
  });
});
