import { expect, it } from "vitest";
import {
  asList,
  IMPORT_JOBS,
  importPath,
  isImportJob,
  jobBySlug,
  jobSchedule,
  runStatus,
  runTone,
} from "./import-runs";
import {
  exampleAppliedSync,
  exampleFailedRun,
  exampleGmailResult,
  exampleHeldSync,
  exampleLumaResult,
  exampleRun,
} from "@/app/(staff)/staff/_components/RunList.examples";

it("knows the jobs", () => {
  expect(isImportJob("sync-politicians")).toBe(true);
  expect(isImportJob("sync-mps")).toBe(false);
  expect(isImportJob("")).toBe(false);
  expect(isImportJob("sync-peers")).toBe(false);
  expect(isImportJob("toString")).toBe(false);
});

it("knows which jobs run on a schedule, and how often", () => {
  expect(jobSchedule("import-luma")).toBe("frequent");
  expect(jobSchedule("import-members")).toBe("hourly");
  expect(jobSchedule("tidy-logs")).toBe("nightly");
});

it("lists a job's newest run, or none", () => {
  expect(asList("run")).toEqual(["run"]);
  expect(asList(undefined)).toEqual([]);
});

it("gives each job a page of its own, and finds the job from its page's slug", () => {
  expect(importPath("check-mps")).toBe("/staff/scheduled-jobs/mp-check");
  for (const job of IMPORT_JOBS) expect(jobBySlug(importPath(job).split("/").pop()!)).toBe(job);
  expect(jobBySlug("history")).toBeUndefined();
});

it("says a run that left work for a later one is incomplete, in place of done or unchanged, but not failed", () => {
  expect(runStatus(exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "time" }))).toBe("incomplete");
  expect(runStatus(exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "running" }))).toBe("incomplete");
  expect(runStatus(exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "rate-limit" }))).toBe("incomplete");
  expect(runStatus(exampleRun("import-luma", exampleLumaResult))).toBe("ok");
  expect(runStatus(exampleFailedRun("import-luma", "boom", {}))).toBe("failed");
  expect(runStatus(exampleHeldSync)).toBe("held");
});

it("says a run that went wrong along the way had problems, whatever else it did, unless it failed outright", () => {
  const problems = [{ what: "Luma wouldn't give an event", error: "Luma answered 503" }];
  expect(runStatus(exampleRun("import-luma", exampleLumaResult, { problems }))).toBe("problems");
  expect(runStatus(exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "time" }, { problems }))).toBe(
    "problems",
  );
  expect(runStatus(exampleRun("import-luma", exampleLumaResult, { status: "unchanged", problems }))).toBe("problems");
  expect(runStatus(exampleRun("check-mps", { problems: [] }, { problems }))).toBe("problems");
  expect(runStatus(exampleRun("read-gmail", exampleGmailResult, { problems }))).toBe("problems");
  expect(runStatus(exampleFailedRun("read-gmail", "boom", { problems }))).toBe("failed");
});

it("colours a run by how it ended: green done, applied or unchanged, amber held, stopped short or with problems, red failed, none otherwise", () => {
  expect(runTone(exampleRun("check-mps", { problems: [] }, { problems: [{ what: "Parliament was slow" }] }))).toBe(
    "amber",
  );
  expect(runTone(exampleRun("check-mps", { problems: [] }))).toBe("green");
  expect(runTone(exampleAppliedSync)).toBe("green");
  expect(runTone(exampleHeldSync)).toBe("amber");
  expect(runTone(exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "time" }))).toBe("amber");
  expect(runTone(exampleRun("import-luma", exampleLumaResult))).toBe("green");
  // postcodes.io failing leaves work for later too.
  expect(runTone(exampleFailedRun("check-mps", "boom", {}))).toBe("red");
  expect(runTone(exampleRun("import-luma", exampleLumaResult, { status: "unchanged" }))).toBe("green");
  expect(runTone(exampleRun("check-mps", { problems: [] }, { status: "discarded" }))).toBeUndefined();
  expect(runTone(undefined)).toBeUndefined();
});
