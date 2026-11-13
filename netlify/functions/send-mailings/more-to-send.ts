/** What a call to /api/cron/send-mailings did, and how many letters and broadcasts' copies are left. */
export type SendingRun = {
  sent: number;
  skipped: number;
  failed: number;
  left: number;
  broadcasts?: { sent: number; skipped: number; failed: number; left: number };
};

/**
 * Whether calling again would send more: letters or copies of broadcasts are
 * left, and this call got through some, so not every account sending them
 * is at its limit, nor every broadcast waiting for CiviCRM. A broadcast's
 * copy failing isn't getting through one: a broadcast sends no more in a
 * call once a copy fails (sendEmails), and were that all a call did, calling
 * again at once would fail the next.
 */
export function moreToSend(run: SendingRun): boolean {
  const broadcasts = run.broadcasts ?? { sent: 0, skipped: 0, failed: 0, left: 0 };
  const left = run.left + broadcasts.left;
  const done = run.sent + run.skipped + run.failed + broadcasts.sent + broadcasts.skipped;
  return left > 0 && done > 0;
}
