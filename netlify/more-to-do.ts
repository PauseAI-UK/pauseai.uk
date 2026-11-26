// Whether the background function (functions/run-job-background) should
// ask the site to run a job again, from what the last call said. Only the
// press survey and sending have more to do than a call can; every other
// job's call does the whole run.

/** What a call to /api/cron/import-press did, and how many finds are left unread; nothing, when another run was going. */
export type PressCall = { searched?: number; read?: number; known?: number; unreadable?: number; left?: number };

/**
 * Whether calling again would read more: finds are left unread, and this
 * call got through some, or searched, so Google and the news sites are
 * answering. A call that did neither was turned away, and the rest wait for
 * the next night.
 */
export function moreToRead({ searched = 0, read = 0, known = 0, unreadable = 0, left = 0 }: PressCall): boolean {
  return left > 0 && searched + read + known + unreadable > 0;
}

type Counts = { sent?: number; skipped?: number; failed?: number; left?: number };

/** What a call to /api/cron/send-mailings did, and how many letters and broadcasts' copies are left; nothing, when another run was going. */
export type SendingCall = Counts & { broadcasts?: Counts };

const done = ({ sent = 0, skipped = 0, failed = 0 }: Counts) => sent + skipped + failed;

/**
 * Whether calling again would send more: letters or copies of broadcasts are
 * left, and this call got through some, so not every account sending them
 * is at its limit, nor every broadcast waiting for CiviCRM.
 */
export function moreToSend({ broadcasts = {}, ...letters }: SendingCall): boolean {
  const left = (letters.left ?? 0) + (broadcasts.left ?? 0);
  return left > 0 && done(letters) + done(broadcasts) > 0;
}

/** Whether `job` has more to do after a call that answered `said`. */
export function moreToDo(job: string, said: object): boolean {
  if (job === "import-press") return moreToRead(said);
  if (job === "send-mailings") return moreToSend(said);
  return false;
}
