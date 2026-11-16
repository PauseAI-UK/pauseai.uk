import { describe, expect, it } from "vitest";
import {
  exampleFailedRun,
  exampleImportResult,
  exampleGmailResult,
  exampleCivicrmResult,
  exampleLumaResult,
  exampleRun,
} from "../../app/(staff)/staff/_components/jobs/RunList.examples";
import { gathers, runLog, runShape } from "./run-log";

const AT = new Date("2026-11-03T12:00:00Z");
const luma = (id: number, extra = {}, at = AT) =>
  exampleRun("import-luma", { ...exampleLumaResult, ...extra }, { id, at });
const stopped = { stoppedBy: "time" as const };
/** A read of Gmail: routine, or a row of its own if it searched again. */
const gmail = (id: number, a: object = {}) =>
  exampleRun(
    "read-gmail",
    { accounts: [{ ...exampleGmailResult.accounts[0], error: undefined, notUnderstood: undefined, ...a }] },
    { id, at: AT },
  );
const quietLuma = (id: number, at = AT) =>
  exampleRun("import-luma", exampleLumaResult, { id, at, status: "unchanged" });
const flat = (days: ReturnType<typeof runLog>) => days.flatMap((d) => d.entries);
/** Each row's kind and how many runs it has. */
const kinds = (days: ReturnType<typeof runLog>) =>
  flat(days).map((e) => [e.kind, e.kind === "run" ? 1 : e.runs.length]);

describe("how a run shows", () => {
  it("gathers runs that found nothing on a job that runs every 5 or 15 minutes or hourly, not nightly", () => {
    expect(gathers("import-luma")).toBe(true);
    expect(gathers("import-civicrm")).toBe(true);
    expect(gathers("import-parliament")).toBe(false);
    expect(gathers("tidy-logs")).toBe(false);
  });

  it("is a row of its own for a job that runs rarely, whatever it did", () => {
    const check = exampleRun("import-parliament", exampleImportResult, { status: "unchanged" });
    expect(runShape(check)).toBe("run");
    expect(runShape(exampleFailedRun("tidy-logs", "boom", {}))).toBe("run");
  });

  it("is gathered when a frequent or hourly job found nothing, unless it stopped short", () => {
    expect(runShape(quietLuma(1))).toBe("quiet");
    expect(runShape(exampleRun("import-civicrm", exampleCivicrmResult, { status: "unchanged" }))).toBe("quiet");
    const stopped = exampleRun(
      "import-luma",
      { ...exampleLumaResult, stoppedBy: "time" as const },
      { status: "unchanged" },
    );
    expect(runShape(stopped)).toBe("run");
  });

  it("is a row of its own for a failure, and for an hourly job that found something", () => {
    expect(runShape(exampleFailedRun("import-luma", "boom", {}))).toBe("run");
    expect(runShape(exampleRun("import-civicrm", exampleCivicrmResult, {}))).toBe("run");
  });

  it("is routine for Luma's ordinary run, and not for one that stopped short", () => {
    expect(runShape(exampleRun("import-luma", exampleLumaResult, {}))).toBe("routine");
    expect(runShape(exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "time" as const }, {}))).toBe("run");
  });

  it("is routine for an ordinary read of Gmail, and not for one with problems or that searched again", () => {
    expect(runShape(gmail(1))).toBe("routine");
    // An account it couldn't read is a problem of the run, not of this read's result.
    expect(runShape(gmail(1, { error: "403" }))).toBe("routine");
    expect(
      runShape(exampleRun("read-gmail", { accounts: [] }, { problems: [{ what: "al@pauseai.uk couldn't be read" }] })),
    ).toBe("run");
    expect(runShape(gmail(1, { restarted: true }))).toBe("run");
  });
});

describe("a job's page", () => {
  it("has a row a run, the newest opened, those that found nothing gathered, under each day", () => {
    const days = runLog(
      [luma(5, stopped), luma(4), luma(3), quietLuma(2), quietLuma(6), quietLuma(1, new Date("2026-11-02T12:00:00Z"))],
      false,
    );
    expect(kinds(days)).toEqual([
      ["run", 1],
      ["run", 1],
      ["run", 1],
      ["quiet", 2],
      ["quiet", 1],
    ]);
    expect(days.map((d) => [d.day, d.entries.length])).toEqual([
      ["3 Nov 2026", 4],
      ["2 Nov 2026", 1],
    ]);
    expect(flat(days).map((e) => e.kind === "run" && e.open)).toEqual([true, false, false, false, false]);
  });

  it("opens none while a press runs, as that's the job's state", () => {
    const [first, second] = flat(runLog([luma(2, stopped), luma(1)], true));
    expect(first).toMatchObject({ kind: "run", open: false });
    expect(second).toMatchObject({ kind: "run", open: false });
  });

  it("folds routine runs past the most recent into one, but never a run of its own", () => {
    const routine = Array.from({ length: 20 }, (_, id) => luma(id));
    expect(kinds(runLog(routine, false))).toEqual([...Array.from({ length: 13 }, () => ["run", 1]), ["folded", 7]]);
    const rare = [1, 2, 3, 4, 5, 6].map((id) => exampleRun("import-parliament", exampleImportResult, { id }));
    expect(kinds(runLog(rare, false))).toEqual(Array.from({ length: 6 }, () => ["run", 1]));
  });

  it("doesn't gather across a run of its own", () => {
    const routine = Array.from({ length: 13 }, (_, id) => luma(100 + id));
    const entries = runLog([...routine, luma(5), luma(3, stopped), luma(2), gmail(9)], false);
    expect(kinds(entries).slice(-3)).toEqual([
      ["folded", 1],
      ["run", 1],
      ["folded", 2],
    ]);
  });
});
