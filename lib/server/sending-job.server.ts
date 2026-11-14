import "server-only";
import { JOBS, type SendingResult } from "@/lib/import-runs";
import { asRun } from "./import-runs.server";
import { sendLetterQueue } from "@/lib/letters/queue.server";
import { uncertainLetters } from "@/lib/letters/sending.server";
import { sendDueLetters, startDueMailings } from "@/lib/mailings/sending.server";
import { sendDueBroadcasts, startDueBroadcasts } from "./broadcast-sending.server";
import { checkTemplates } from "./whatsapp-templates.server";

const JOB = "send-mailings";

/**
 * One run of the sending, kept in the import log: first marking letters a
 * stopped run left sending as uncertain (uncertainLetters), so a mailing
 * with one can finish; then the letters inbox's queue
 * (lib/letters/queue.server.ts), then the mailings due and their letters
 * (mailing-sending.ts), then what WhatsApp has decided of our templates
 * (whatsapp-templates.server.ts), then the broadcasts to supporters due and their
 * copies (broadcast-sending.server.ts), for its budget (JOBS) in all, short of what Netlify
 * gives a function, so a slow last send still finishes. The background
 * function (netlify/functions/send-mailings-background) runs it again until
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
    const anything =
      started.length + result.sent + result.failed + queue.sent + broadcasts.started.length + broadcasts.sent > 0;
    return { status: anything ? "ok" : "unchanged", result } as const;
  });
  return result;
}
