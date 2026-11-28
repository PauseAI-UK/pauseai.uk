import "server-only";
import { JOBS } from "@/lib/import-runs";
import type { SendingResult } from "@/lib/import-run-types";
import { asRun } from "@/lib/server/import-runs.server";
import { sendLetterQueue } from "@/lib/letters/queue.server";
import { uncertainLetters } from "@/lib/letters/sending.server";
import { sendDueLetters, startDueMailings } from "@/lib/mailings/sending.server";
import { sendDueBroadcasts, startDueBroadcasts } from "@/lib/broadcasts/sending.server";
import { checkTemplates } from "@/lib/broadcasts/whatsapp-templates.server";
import { alertWaitingTexts } from "@/lib/broadcasts/text-alerts.server";
import { emailHeld } from "@/lib/broadcasts/waiting-room.server";

const JOB = "send-mailings";

/**
 * One run of the sending, kept in the import log: first marking letters a
 * stopped run left sending as uncertain (uncertainLetters), so a mailing
 * with one can finish; then the letters inbox's queue
 * (lib/letters/queue.server.ts), then the mailings due and their letters
 * (mailing-sending.ts), then what WhatsApp has decided of our templates
 * (whatsapp-templates.server.ts), then the broadcasts to supporters due and their
 * copies (lib/broadcasts/sending.server.ts), then the email to staff about
 * replies to texts left waiting (lib/broadcasts/text-alerts.server.ts),
 * and the day's email about who's held in the WhatsApp waiting room
 * (lib/broadcasts/waiting-room.server.ts), for its budget (JOBS) in all, short of what Netlify
 * gives a function, so a slow last send still finishes. The background
 * function that runs every job (netlify/functions/run-job-background) runs it again until
 * it's done. `request` is the job's call, for links in alerts; a staff
 * member's run has none.
 */
export async function runSending(startedBy: string, request?: Request): Promise<SendingResult> {
  const { result } = await asRun(JOB, startedBy, async () => {
    const until = Date.now() + JOBS[JOB].budgetMs;
    await uncertainLetters();
    const queue = await sendLetterQueue(until, request);
    const started = await startDueMailings();
    const result: SendingResult = { started, ...(await sendDueLetters({ until })), queue };
    // What WhatsApp has decided of our templates first, so a text on one it has paused doesn't go.
    await checkTemplates();
    const broadcasts = { started: await startDueBroadcasts(), ...(await sendDueBroadcasts(until)) };
    result.broadcasts = broadcasts;
    await alertWaitingTexts(request);
    await emailHeld(request);
    const anything =
      started.length + result.sent + result.failed + queue.sent + broadcasts.started.length + broadcasts.sent > 0;
    return { status: anything ? "ok" : "unchanged", result } as const;
  });
  return result;
}
