import "server-only";
import { staffCopy } from "@/lib/content/staff-interface";
import { REFUSALS_BEFORE_EMAIL, type SpamCheckedForm } from "@/lib/spam-check-runs";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { staffTime } from "@/lib/staff-time";
import { config } from "./config";
import { query } from "./db";
import { notifyStaff, staffLink } from "./notifications";
import { problem } from "./problems";

// A spam check that refuses someone throws nothing, so nothing else would
// notice it refusing everyone: a key that's wrong, a widget that won't load.
// Each submission of a form that it refuses is counted, until it lets one
// through, and staff are emailed once when it has refused several in a row
// (spam_check_runs). A bot's run of refusals looks the same, so the email
// says to try the form, not that it's broken.

/**
 * Counts one submission of `form` that the spam check refused, or let
 * through, which ends the run of refusals. Never throws: a count that can't
 * be kept is no reason to lose the submission.
 */
export async function countSpamCheck(form: SpamCheckedForm, passed: boolean): Promise<void> {
  try {
    if (passed) {
      await query(
        "UPDATE spam_check_runs SET refused = 0, since = NULL, alerted = false WHERE form = $1 AND refused > 0",
        [form],
      );
      return;
    }
    await query(
      `INSERT INTO spam_check_runs (form, refused, since) VALUES ($1, 1, now())
       ON CONFLICT (form) DO UPDATE
         SET refused = spam_check_runs.refused + 1, since = coalesce(spam_check_runs.since, now())`,
      [form],
    );
    if (!config.notificationInbox) return;
    // Taken before the email goes, so two refusals at once send one.
    const [due] = await query<{ refused: number; since: Date }>(
      `UPDATE spam_check_runs SET alerted = true WHERE form = $1 AND NOT alerted AND refused >= $2
       RETURNING refused, since`,
      [form, REFUSALS_BEFORE_EMAIL],
    );
    if (!due) return;
    const words = staffCopy.notifications.lettersRefused;
    await notifyStaff(
      words.subject(due.refused),
      words.body(due.refused, staffTime(due.since), staffLink(ERRORS_LIST.path, undefined)),
    );
  } catch (error) {
    problem(staffCopy.problems.logs.spamCheckNotCounted, error);
  }
}
