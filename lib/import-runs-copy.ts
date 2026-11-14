// The import log's words (lib/import-runs.ts, lib/server/import-runs.server.ts): each job's title, and the
// emails to staff when a job's run fails or has problems.
import type { ImportJob } from "@/lib/import-runs";
import { jobsCopy } from "@/lib/jobs/copy";
import { politiciansCopy } from "@/lib/politicians/copy";

export const importRunsCopy = {
  // Each job in the import log, by the title of its card on the Scheduled jobs page and of its own page.
  jobTitles: {
    ...politiciansCopy.politicianImports.titles,
    "import-controlai": jobsCopy.controlAi.title,
    "import-controlai-statement": jobsCopy.controlAiStatement.title,
    "import-luma": jobsCopy.luma.title,
    "import-civicrm": jobsCopy.civicrm.title,
    "read-gmail": jobsCopy.gmailReading.title,
    "send-mailings": jobsCopy.sending.title,
    "tidy-logs": jobsCopy.tidying.title,
  } as Record<ImportJob, string>,
  // The emails to the notification inbox (lib/email/notifications.server.ts) about a job's run.
  notifications: {
    // An import's run failed, after one that didn't: its title, its error, its page.
    // A run that went wrong along the way, without failing: each problem, a line.
    importProblems: {
      subject: (job: string) => `The import '${job}' had problems`,
      body: (job: string, problems: string[], link: string) =>
        `The import '${job}' ran, but:\n\n${problems.join("\n")}\n\nIt will try again at its next run, and you won't be emailed again until it has worked, or something else goes wrong.\n\nIts runs: ${link}`,
    },
    importFailed: {
      subject: (job: string) => `The import '${job}' failed`,
      body: (job: string, error: string, link: string) =>
        `The import '${job}' failed with the error: "${error}". It will try again at its next run, and you won't be emailed again until it has worked.\n\nIts runs: ${link}`,
    },
  },
};
