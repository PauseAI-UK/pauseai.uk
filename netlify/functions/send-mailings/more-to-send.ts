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
 * is at its limit, nor every broadcast waiting for CiviCRM.
 */
export function moreToSend(run: SendingRun): boolean {
  const broadcasts = run.broadcasts ?? { sent: 0, skipped: 0, failed: 0, left: 0 };
  const left = run.left + broadcasts.left;
  const done = run.sent + run.skipped + run.failed + broadcasts.sent + broadcasts.skipped + broadcasts.failed;
  return left > 0 && done > 0;
}
