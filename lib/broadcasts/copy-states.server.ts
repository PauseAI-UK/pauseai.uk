import "server-only";
import { MOST_FINISH_MINUTES } from "./broadcasts";
import { DELAYED, SOFT_BOUNCED } from "./delayed";
import { howOptedOutFrom, optedOutFrom } from "@/lib/supporters/opt-outs.server";

// Where each copy of a broadcast stands, and why, as SQL over a copy `c`
// (broadcast_messages), for a broadcast's page (./pages.server.ts) and a
// supporter's (./supporter-pages.server.ts).

// Why a copy's broadcast stopped by itself, when it did (its wait_reason), so a copy it left unsent can say so.
const STOPPED_BY = "(SELECT CASE WHEN g.gave_up THEN g.wait_reason END FROM mailings g WHERE g.id = c.mailing_id)";
const WAS_READ = "EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'read')";
const BOUNCED = "EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'bounced')";
// They asked us to stop after it reached them: its provider said so (a WhatsApp stop, a spam complaint), or an
// opt-out was made from it (our link, their mail app's Unsubscribe, their reply).
const OPTED_OUT = `(EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'opted-out')
  OR ${optedOutFrom("c.id")})`;
// How they asked, from the first opt-out made from it.
const STOPPED_VIA = howOptedOutFrom("c.id");
const REPLIED = "EXISTS (SELECT 1 FROM broadcast_replies r WHERE r.message_id = c.id AND NOT r.automatic)";
export const TO_LOOK_AT =
  "EXISTS (SELECT 1 FROM broadcast_replies r WHERE r.message_id = c.id AND NOT r.automatic AND r.outcome IS NULL)";
// A text's number WhatsApp said isn't on it when this copy went, rather than known before.
const FOUND_UNREACHABLE = "EXISTS (SELECT 1 FROM whatsapp_unreachable u WHERE u.message_id = c.id)";
// Its send cut off, so it may have gone (fail in broadcast-sending.server.ts).
const UNFINISHED = `EXISTS (SELECT 1 FROM broadcast_message_events e
  WHERE e.message_id = c.id AND e.kind = 'failed' AND e.details ? 'unfinished')`;

/**
 * Where a copy stands, one state each, the first that applies: a reply to
 * check; they opted out because of it; something broke (its provider
 * refused it, its send cut off, its broadcast gave up, or it was delayed
 * till its broadcast stopped trying); it didn't reach them (a bounce,
 * or a number found not on WhatsApp); not sent, as expected (they'd opted
 * out before, their consent ended, an address already blocked, we
 * cancelled); replied; read; delivered; sent; or still to go: held, which
 * its tag calls delayed (DELAYED), or to go, its turn yet to come or being
 * sent. Each count and tab on a broadcast's page is one of these.
 */
export const COPY_STATES = [
  "look",
  "opted-out",
  "error",
  "unreached",
  "not-sent",
  "replied",
  "read",
  "delivered",
  "sent",
  "held",
  "to-go",
] as const;
/** A copy's state, or, for one of a broadcast not yet sending, which has no copies, scheduled (scheduledRecipients). */
export type CopyState = (typeof COPY_STATES)[number] | "scheduled";

// Held by WhatsApp, as the person has had enough marketing messages lately (holdCopy, in sending.server.ts): put
// back to go no sooner than a time still to come.
export const HELD = "c.status = 'scheduled' AND c.not_before > now()";
// Its broadcast has stopped trying (its finish, in minutes as sendingStopsAt counts), or it was stopped, as staff
// gave up on those delayed (stopBroadcast): a copy still delayed counts as never arriving. If Postmark delivers it
// after all, it's delivered.
const DAYS_OUT = `(SELECT g.state = 'cancelled'
    OR g.due_at + make_interval(mins => coalesce(g.finish_minutes, ${MOST_FINISH_MINUTES})) <= now()
  FROM mailings g WHERE g.id = c.mailing_id)`;

export const COPY_STATE = `CASE
  WHEN ${TO_LOOK_AT} THEN 'look'
  WHEN ${HELD} THEN 'held'
  WHEN c.status IN ('scheduled', 'sending') THEN 'to-go'
  WHEN c.status IN ('sent', 'delivered') AND ${OPTED_OUT} THEN 'opted-out'
  WHEN (c.status = 'failed' AND NOT ${BOUNCED}) OR (c.status = 'cancelled' AND ${STOPPED_BY} IS NOT NULL) THEN 'error'
  WHEN c.status = 'failed' OR (c.skip_reason = 'not-on-whatsapp' AND ${FOUND_UNREACHABLE}) THEN 'unreached'
  WHEN c.status IN ('skipped', 'cancelled') THEN 'not-sent'
  WHEN ${REPLIED} THEN 'replied'
  WHEN ${WAS_READ} THEN 'read'
  WHEN ${DELAYED} AND ${DAYS_OUT} THEN 'error'
  WHEN ${DELAYED} THEN 'held'
  WHEN c.status = 'delivered' THEN 'delivered'
  ELSE 'sent' END`;

// What delayed a copy, or made it an error once its days ran out: WhatsApp's limit, which leaves it to go (or, once
// its broadcast stopped as its days ran out, cancelled); a soft bounce; or Postmark's silence.
const DELAYED_BY = `CASE WHEN c.status IN ('scheduled', 'cancelled') THEN 'whatsapp-limit'
  WHEN ${SOFT_BOUNCED} THEN 'soft-bounce' ELSE 'postmark-silent' END`;

// Why it's in its state, where that has a why: how they opted out; what broke (Gmail, Postmark or WhatsApp
// refusing it, a send cut off, delayed till its days ran out, or why its broadcast gave up); what's delaying it;
// bounced or not on WhatsApp; why it wasn't sent (a skip reason, cancelled, or opted out in WhatsApp before).
export const COPY_WHY = `CASE ${COPY_STATE}
  WHEN 'opted-out' THEN ${STOPPED_VIA}
  WHEN 'held' THEN ${DELAYED_BY}
  WHEN 'error' THEN CASE
    WHEN c.status = 'sent' OR (c.status = 'cancelled' AND c.not_before IS NOT NULL AND ${STOPPED_BY} IN ('limit', 'late'))
      THEN ${DELAYED_BY}
    ELSE coalesce(${STOPPED_BY}, CASE WHEN ${UNFINISHED} THEN 'unfinished'
      ELSE (SELECT CASE WHEN g.channel = 'text' THEN 'whatsapp' ELSE g.send_by END FROM mailings g WHERE g.id = c.mailing_id) END) END
  WHEN 'unreached' THEN CASE WHEN ${BOUNCED} THEN 'bounced' ELSE 'not-on-whatsapp' END
  WHEN 'not-sent' THEN CASE WHEN c.status = 'cancelled' THEN 'cancelled'
    WHEN c.skip_reason = 'unsubscribed' AND ${STOPPED_VIA} = 'whatsapp-refused' THEN 'whatsapp'
    ELSE c.skip_reason END
  END`;
