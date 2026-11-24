import { afterEach, expect, it, vi } from "vitest";
import { describeWithDatabase, useTestDatabase } from "@/tests/database";
import { notifications } from "@/tests/notifications";
import { query } from "./db.server";
import { defineProblems } from "@/lib/problems";
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
import { importRunsCopy } from "@/lib/import-runs-copy";

/** Problems as a feature declares them, each with a code of its own. */
const said = defineProblems("imports", {
  eventUnloaded: "An event wouldn't load",
  hostUnloaded: "A host wouldn't load",
  postcodesDown: "Postcodes.io failed",
  disconnected: "Google disconnected an account",
  slow: "Parliament was slow",
  down: "Parliament was down",
  unmatched: (p: { count: number }) => `Messages that matched nothing: ${p.count}`,
});
type Said = ReturnType<typeof said.slow>;

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
    const words = importRunsCopy.notifications.importFailed;
    const luma = importRunsCopy.jobTitles["import-luma"];
    expect(sent.map((email) => [email.Subject, email.TextBody])).toEqual([
      [words.subject(luma), words.body(luma, "Luma is down", "https://pauseai.uk/staff/scheduled-jobs/luma")],
      [words.subject(luma), words.body(luma, "Luma is down again", "https://pauseai.uk/staff/scheduled-jobs/luma")],
    ]);
  });

  it("keeps what a run reports as problems on it, and emails once for each new one, not for the same again", async () => {
    const sent = notifications();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const run = (whats: Said[], after: Said[] = []) =>
      asRun("import-luma", "nightly", async () => {
        for (const what of whats) problem(what, new Error("503"));
        for (const what of after) problem(what);
        return { status: "ok", result: { events: 1 } } as const;
      });
    await asRun("import-luma", "nightly", async () => {
      // One with an alert of its own: kept, but not emailed about again.
      problem(said.disconnected(), undefined, { told: true });
      return ended();
    });
    await run([said.eventUnloaded()], [said.postcodesDown()]);
    await run([said.eventUnloaded(), said.postcodesDown()]);
    await run([said.eventUnloaded(), said.hostUnloaded()]);
    await run([]);
    await run([said.eventUnloaded()]);
    expect(await listRuns("import-luma")).toMatchObject([
      { problems: [{ code: "imports.eventUnloaded", what: "An event wouldn't load", said: "503" }] },
      { problems: [] },
      { problems: [{ what: "An event wouldn't load" }, { what: "A host wouldn't load" }] },
      { problems: [{ what: "An event wouldn't load" }, { what: "Postcodes.io failed" }] },
      {
        result: { events: 1 },
        problems: [{ what: "An event wouldn't load", said: "503" }, { what: "Postcodes.io failed" }],
      },
      { problems: [{ what: "Google disconnected an account", told: true }] },
    ]);
    expect(await latestRun("import-luma")).toMatchObject({
      status: "ok",
      problems: [{ what: "An event wouldn't load" }],
    });
    const words = importRunsCopy.notifications.importProblems;
    const luma = importRunsCopy.jobTitles["import-luma"];
    const link = "https://pauseai.uk/staff/scheduled-jobs/luma";
    expect(sent.map((email) => [email.Subject, email.TextBody])).toEqual([
      [words.subject(luma), words.body(luma, ["- An event wouldn't load 503", "- Postcodes.io failed"], link)],
      [words.subject(luma), words.body(luma, ["- An event wouldn't load 503", "- A host wouldn't load 503"], link)],
      [words.subject(luma), words.body(luma, ["- An event wouldn't load 503"], link)],
    ]);
  });

  it("doesn't email again about a problem with the same code, whatever it's about this time", async () => {
    const sent = notifications();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const letters = defineProblems("letters", {
      notSent: (p: { letter: number }) => `Letter ${p.letter} couldn't be sent`,
      copyNotSent: (p: { letter: number }) => `The copy of letter ${p.letter} couldn't be sent`,
    });
    const run = (...reported: ReturnType<typeof letters.notSent>[]) =>
      asRun("send-mailings", "nightly", async () => {
        for (const one of reported) problem(one, new Error("Gmail answered 503"));
        return ended();
      });
    await run(letters.notSent({ letter: 4127 }));
    await run(letters.notSent({ letter: 4128 }), letters.notSent({ letter: 4129 }));
    expect(sent).toHaveLength(1);
    // Another problem about the same letter is new.
    await run(letters.notSent({ letter: 4128 }), letters.copyNotSent({ letter: 4128 }));
    const words = importRunsCopy.notifications.importProblems;
    const title = importRunsCopy.jobTitles["send-mailings"];
    expect(sent.map((email) => email.TextBody)).toEqual([
      words.body(
        title,
        ["- Letter 4127 couldn't be sent Gmail answered 503"],
        "https://pauseai.uk/staff/scheduled-jobs/sending",
      ),
      words.body(
        title,
        [
          "- Letter 4128 couldn't be sent Gmail answered 503",
          "- The copy of letter 4128 couldn't be sent Gmail answered 503",
        ],
        "https://pauseai.uk/staff/scheduled-jobs/sending",
      ),
    ]);
    expect(await latestRun("send-mailings")).toMatchObject({
      problems: [
        { code: "letters.notSent", values: { letter: 4128 }, said: "Gmail answered 503" },
        { code: "letters.copyNotSent", values: { letter: 4128 } },
      ],
    });
  });

  it("doesn't email about a problem the run before kept by the same sentence, before problems had codes", async () => {
    const sent = notifications();
    vi.spyOn(console, "error").mockImplementation(() => {});
    // A run as one was kept then: its problem a sentence, with the error's words as `error`.
    await query(
      `INSERT INTO import_runs (job, started_by, status, result, problems)
       VALUES ('import-parliament', 'nightly', 'ok', '{}', '[{ "what": "Parliament was slow", "error": "503" }]')`,
    );
    await asRun("import-parliament", "nightly", async () => {
      problem(said.slow());
      return ended();
    });
    expect(sent).toEqual([]);
    await asRun("import-parliament", "nightly", async () => {
      problem(said.slow());
      problem(said.down());
      return ended();
    });
    expect(sent).toHaveLength(1);
    // The email says an old run's problem with its error's words, as a new one's.
    await query("DELETE FROM import_runs WHERE problems->0->>'code' IS NOT NULL");
    await asRun("import-parliament", "nightly", async () => ended());
    await query(
      `INSERT INTO import_runs (job, started_by, status, result, problems)
       VALUES ('import-parliament', 'nightly', 'ok', '{}', '[{ "what": "Parliament was slow", "error": "503" }]')`,
    );
    expect((await latestRun("import-parliament"))?.problems).toEqual([{ what: "Parliament was slow", error: "503" }]);
  });

  it("doesn't email again about a problem whose count alone has changed", async () => {
    const sent = notifications();
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const count of [2, 3]) {
      await asRun("import-parliament", "nightly", async () => {
        problem(said.unmatched({ count }));
        return ended();
      });
    }
    expect(sent).toHaveLength(1);
  });

  it("leaves a problem with an alert of its own out of the email about another", async () => {
    const sent = notifications();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await asRun("import-parliament", "nightly", async () => {
      problem(said.disconnected(), undefined, { told: true });
      problem(said.slow());
      return ended();
    });
    const title = importRunsCopy.jobTitles["import-parliament"];
    expect(sent.map((email) => email.TextBody)).toEqual([
      importRunsCopy.notifications.importProblems.body(
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
        problem(said.slow());
        return ended();
      });
    await slow();
    await asRun("import-parliament", "nightly", async () => {
      problem(said.slow());
      throw new Error("then it went away");
    }).catch(() => {});
    await slow();
    expect(await listRuns("import-parliament")).toMatchObject([
      { status: "ok", problems: [{ what: "Parliament was slow" }] },
      { status: "failed", error: "then it went away", problems: [{ what: "Parliament was slow" }] },
      { status: "ok", problems: [{ what: "Parliament was slow" }] },
    ]);
    expect(sent.map((email) => email.Subject)).toEqual([
      importRunsCopy.notifications.importProblems.subject(importRunsCopy.jobTitles["import-parliament"]),
      importRunsCopy.notifications.importFailed.subject(importRunsCopy.jobTitles["import-parliament"]),
      importRunsCopy.notifications.importProblems.subject(importRunsCopy.jobTitles["import-parliament"]),
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
