import { afterEach, expect, it, vi } from "vitest";
import { jobTitles, staffCopy } from "@/lib/content/staff-interface";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { notifications } from "@/tests/notifications";
import { query } from "./db.server";
import { problem } from "./problems.server";
import {
  asRun,
  latestRun,
  listRuns,
  recordFailure,
  recordRun,
  runningNow,
  startRunning,
  stopRunning,
} from "./import-runs.server";

/** A run's work that ends as it says, with nothing to say of what it found. */
const ended = (status: "ok" | "unchanged" = "ok") => ({ status, result: {} });

describeWithDatabase("the import log", () => {
  useTestDatabase();
  afterEach(() => vi.unstubAllEnvs());

  it("emails the notification inbox when a job fails, once, until a run of it has worked", async () => {
    const sent = notifications();
    const fail = (why: string) =>
      asRun("import-luma", "nightly", async () => {
        throw new Error(why);
      }).catch(() => {});
    await fail("Luma is down");
    await fail("Luma is still down");
    await asRun("import-luma", "nightly", async () => ended("unchanged"));
    await fail("Luma is down again");
    const words = staffCopy.notifications.importFailed;
    const luma = jobTitles["import-luma"];
    expect(sent.map((email) => [email.Subject, email.TextBody])).toEqual([
      [words.subject(luma), words.body(luma, "Luma is down", "https://pauseai.uk/staff/scheduled-jobs/luma")],
      [words.subject(luma), words.body(luma, "Luma is down again", "https://pauseai.uk/staff/scheduled-jobs/luma")],
    ]);
  });

  it("keeps what a run reports as problems on it, and emails once for each new one, not for the same again", async () => {
    const sent = notifications();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const run = (whats: string[], after: string[] = []) =>
      asRun("import-luma", "nightly", async () => {
        for (const what of whats) problem(what, new Error("503"));
        for (const what of after) problem(what);
        return { status: "ok", result: { events: 1 } } as const;
      });
    await asRun("import-luma", "nightly", async () => {
      // One with an alert of its own: kept, but not emailed about again.
      problem("Google disconnected an account", undefined, { told: true });
      return ended();
    });
    await run(["An event wouldn't load"], ["Postcodes.io failed"]);
    await run(["An event wouldn't load", "Postcodes.io failed"]);
    await run(["An event wouldn't load", "A host wouldn't load"]);
    await run([]);
    await run(["An event wouldn't load"]);
    expect(await listRuns("import-luma")).toMatchObject([
      { problems: [{ what: "An event wouldn't load", error: "503" }] },
      { problems: [] },
      { problems: [{ what: "An event wouldn't load" }, { what: "A host wouldn't load" }] },
      { problems: [{ what: "An event wouldn't load" }, { what: "Postcodes.io failed" }] },
      {
        result: { events: 1 },
        problems: [{ what: "An event wouldn't load", error: "503" }, { what: "Postcodes.io failed" }],
      },
      { problems: [{ what: "Google disconnected an account", told: true }] },
    ]);
    expect(await latestRun("import-luma")).toMatchObject({
      status: "ok",
      problems: [{ what: "An event wouldn't load" }],
    });
    const words = staffCopy.notifications.importProblems;
    const luma = jobTitles["import-luma"];
    const link = "https://pauseai.uk/staff/scheduled-jobs/luma";
    expect(sent.map((email) => [email.Subject, email.TextBody])).toEqual([
      [words.subject(luma), words.body(luma, ["- An event wouldn't load 503", "- Postcodes.io failed"], link)],
      [words.subject(luma), words.body(luma, ["- An event wouldn't load 503", "- A host wouldn't load 503"], link)],
      [words.subject(luma), words.body(luma, ["- An event wouldn't load 503"], link)],
    ]);
  });

  it("doesn't email again about a problem whose error alone has changed", async () => {
    const sent = notifications();
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const count of [2, 3]) {
      await asRun("import-parliament", "nightly", async () => {
        problem("Messages that matched nothing:", count);
        return ended();
      });
    }
    expect(sent).toHaveLength(1);
  });

  it("leaves a problem with an alert of its own out of the email about another", async () => {
    const sent = notifications();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await asRun("import-parliament", "nightly", async () => {
      problem("Google disconnected an account", undefined, { told: true });
      problem("Parliament was slow");
      return ended();
    });
    const title = jobTitles["import-parliament"];
    expect(sent.map((email) => email.TextBody)).toEqual([
      staffCopy.notifications.importProblems.body(
        title,
        ["- Parliament was slow"],
        "https://pauseai.uk/staff/scheduled-jobs/parliament",
      ),
    ]);
    // Still on the run, for its page.
    expect(await latestRun("import-parliament")).toMatchObject({
      problems: [{ what: "Google disconnected an account", told: true }, { what: "Parliament was slow" }],
    });
  });

  it("emails about a failure after a run with problems, and about problems after a failure, as each is new", async () => {
    const sent = notifications();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const slow = () =>
      asRun("import-parliament", "nightly", async () => {
        problem("Parliament was slow");
        return ended();
      });
    await slow();
    await asRun("import-parliament", "nightly", async () => {
      problem("Parliament was slow");
      throw new Error("then it went away");
    }).catch(() => {});
    await slow();
    expect(await listRuns("import-parliament")).toMatchObject([
      { status: "ok", problems: [{ what: "Parliament was slow" }] },
      { status: "failed", error: "then it went away", problems: [{ what: "Parliament was slow" }] },
      { status: "ok", problems: [{ what: "Parliament was slow" }] },
    ]);
    expect(sent.map((email) => email.Subject)).toEqual([
      staffCopy.notifications.importProblems.subject(jobTitles["import-parliament"]),
      staffCopy.notifications.importFailed.subject(jobTitles["import-parliament"]),
      staffCopy.notifications.importProblems.subject(jobTitles["import-parliament"]),
    ]);
  });

  it("keeps how a run ended and what it found, and gives the caller all the work said, emailing nobody when it went well", async () => {
    const sent = notifications();
    const done = await asRun("import-parliament", "jo@pauseai.uk", async () => ({
      status: "unchanged" as const,
      result: { problems: [] },
      extra: 42,
    }));
    expect(done.extra).toBe(42);
    expect(await listRuns("import-parliament")).toMatchObject([
      { status: "unchanged", startedBy: "jo@pauseai.uk", result: { problems: [] }, problems: [] },
    ]);
    expect(sent).toEqual([]);
  });

  it("keeps each run with who started it and what it found, newest first, a job at a time", async () => {
    const id = await recordRun("import-parliament", "nightly", "ok", { problems: [] });
    await recordRun("import-senedd", "jo@pauseai.uk", "unchanged", { changes: {} });
    await recordFailure("import-senedd", "nightly", new Error("The Senedd answered 422"));
    await recordFailure("import-senedd", "nightly", "not an Error");

    expect(await listRuns("import-senedd")).toMatchObject([
      {
        job: "import-senedd",
        status: "failed",
        startedBy: "nightly",
        error: "not an Error",
        result: {},
        decidedBy: null,
      },
      { status: "failed", startedBy: "nightly", error: "The Senedd answered 422", result: {} },
      { status: "unchanged", startedBy: "jo@pauseai.uk", error: null, result: { changes: {} } },
    ]);
    expect(await listRuns("import-parliament")).toMatchObject([{ id, status: "ok", result: { problems: [] } }]);
    expect(await latestRun("import-parliament")).toMatchObject({ id });
    expect(await latestRun("import-senedd")).toMatchObject({ error: "not an Error" });
    expect(await latestRun("import-controlai")).toBeUndefined();
  });

  it("throws on, emailing nobody, when a run can't be kept at all", async () => {
    const sent = notifications();
    // JSON can't hold a BigInt.
    await expect(
      asRun("import-parliament", "nightly", async () => ({ status: "ok", result: { n: BigInt(1) } }) as const),
    ).rejects.toThrow("BigInt");
    expect(await listRuns("import-parliament")).toEqual([]);
    expect(sent).toEqual([]);
  });

  it("asRun keeps a failure and throws it on", async () => {
    await expect(
      asRun("import-parliament", "nightly", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await listRuns("import-parliament")).toMatchObject([{ status: "failed", error: "boom", problems: [] }]);
  });

  it("lets one run of a job go at a time, until it ends or is older than any can be", async () => {
    expect(await runningNow("tidy-logs")).toBeUndefined();
    expect(await startRunning("tidy-logs", "nightly")).toBe(true);
    expect(await runningNow("tidy-logs")).toMatchObject({ startedBy: "nightly" });
    expect(await startRunning("tidy-logs", "sam@pauseai.uk")).toBe(false);
    expect(await startRunning("import-parliament", "sam@pauseai.uk")).toBe(true);
    await stopRunning("tidy-logs");
    expect(await startRunning("tidy-logs", "sam@pauseai.uk")).toBe(true);
    await query("UPDATE job_presses SET started_at = now() - interval '6 minutes' WHERE job = 'tidy-logs'");
    expect(await runningNow("tidy-logs")).toBeUndefined();
    expect(await startRunning("tidy-logs", "jo@pauseai.uk")).toBe(true);
  });
});
