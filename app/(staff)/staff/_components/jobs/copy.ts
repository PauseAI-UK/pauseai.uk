// The words of the scheduled jobs' pages that only they show: the
// overview of every job, and the line each run starts with, with those the
// server uses too (lib/jobs/copy.ts).
import { count } from "@/lib/content/plural";
import { jobsCopy as wordsTheServerUses } from "@/lib/jobs/copy";

export const jobsCopy = {
  ...wordsTheServerUses,
  // The line every run in the import log starts with (RunBox): how it
  // ended, when, who started it, and for a held MP import, who decided it.
  // A Luma import that left work for later is incomplete in place of done
  // or unchanged.
  runs: {
    status: {
      ok: "Done",
      incomplete: "Incomplete",
      running: "Running",
      problems: "Problems",
      failed: "Failed",
      unchanged: "Unchanged",
      held: "Held",
      applied: "Applied",
      discarded: "Discarded",
    } as Record<string, string>,
    by: (who: string) => `by ${who}`,
    // A failed run's error, as it came.
    error: (error: string) => `Error: "${error}"`,
    decidedBy: (who: string) => `decided by ${who}`,
    // A held run discarded as a newer run of its job came after it, as only the newest list can be applied.
    replaced: "replaced by a newer run",
    // A job's frequent runs, in a table: its columns' headings, where a job has
    // no counts of its own, the time of a stretch of runs, and what a stretch was.
    time: "Time",
    found: "What it found",
    range: (from: string, to: string) => (from === to ? from : `${from}–${to}`),
    quiet: (n: number) => `${count(n, "run", "runs")}, nothing new`,
    stretch: (n: number) => `${count(n, "run", "runs")}, no problems`,
  },
  import: {
    // The page with every scheduled job: the imports, each body's members,
    // ControlAI's letter and statement from the web, Luma and CiviCRM, and
    // the rest, such as reading Gmail, sending mailings and tidying the logs.
    pageTitle: "Scheduled jobs",
    // Under the title.
    pageIntro: "Imports, mail and tidying that run on a timer",
    // Each job's icon, named for screen readers and on hover: where it reads
    // from or works on. Then how often it runs, the overview's headings and a
    // lozenge on the job's page.
    parliament: "UK Parliament",
    "scottish-parliament": "Scottish Parliament",
    senedd: "Welsh Parliament",
    "ni-assembly": "Northern Ireland Assembly",
    controlai: "ControlAI",
    database: "Database",
    luma: "Luma",
    civicrm: "CiviCRM",
    gmail: "Gmail",
    nightly: "Nightly",
    // What a job that isn't an import does, a lozenge after its name: compares
    // with another list, reads mail, sends mail, or keeps the site tidy.
    kinds: {
      check: "Check",
      read: "Reads mail",
      send: "Sends mail",
      tidy: "Tidy",
    },
    // After that, for the Luma import, which tags Luma's events. Reading Gmail,
    // which relays mail and emails staff, has "Sends mail" (kinds.send).
    changesLuma: "Changes Luma",
    // On a job's page, while a run of it is going: one a staff member started, or one of its schedule's.
    running: (who: string, when: string) => `Running, started by ${who} at ${when}. Can only run one at a time.`,
    runningScheduled: (when: string) => `Running now, started at ${when}. Can only run one at a time.`,
    frequent: "Every 5 minutes",
    "quarter-hour": "Every 15 minutes",
    hourly: "Hourly",
  },
};
