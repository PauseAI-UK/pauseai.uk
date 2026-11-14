import "server-only";
import { randomUUID } from "node:crypto";
import { hasWay, TOPICS, type Topic, type Way } from "./contact-permissions";
import { now } from "@/lib/now";
import { logChange } from "@/lib/server/audit";
import { queueOptOut } from "@/lib/server/civicrm-updates";
import { query, transaction, type Queryable } from "@/lib/server/db";

// Each time an address or number opted out of a topic by a way, or out of
// every bulk email or all email, and when it opted back in, if it has
// (opt_outs). It's opted out while it has an open row, one at most per
// topic and way. Keyed by address, not person: an unsubscribe can arrive
// before we know whose address it is. Luma's calendar emails are events by
// email. contact_permission() reads it. Each of ours that CiviCRM takes
// goes to it too (civicrm-updates.ts).

/**
 * What can record an opt-out: Luma's webhook, a full pass over the
 * calendar's contacts, or CiviCRM's lists; an email's unsubscribe link, or a
 * mail app's Unsubscribe button; a spam complaint; staff, for a reply or
 * anything else the person told them; the contact preferences page;
 * CiviCRM's suppression check before a broadcast; or WhatsApp
 * (whatsapp-stops.ts).
 */
export type OptOutSource =
  | "luma-webhook"
  | "luma-contacts"
  | "civicrm"
  | "link"
  | "list-unsubscribe"
  | "postmark-complaint"
  | "reply"
  | "staff"
  | "preferences"
  | "civicrm-check"
  | "whatsapp";

/** What an opt-out stops: a topic, or by email every bulk email (`bulk`), or all email (`all`). */
export type OptOutList = Topic | "bulk" | "all";

export type OptOut = {
  address: string;
  /** What's opted out of, by `way`, email unless it says. */
  list: OptOutList;
  way?: Way;
  source: OptOutSource;
  /** The source's own ID for it, so the same news told twice is kept once. */
  sourceRef: string;
  unsubscribedAt: Date;
  /** The staff member who recorded it, for a reply or anything else told them. */
  recordedBy?: string;
  /** How the person gave it, for one staff recorded from anything but a reply. */
  how?: string;
  /** The copy of a broadcast it came from: its link, a reply to it, or a complaint about it. */
  messageId?: number;
};

/** The address as the table keeps it: trimmed and lowercased. */
export function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Records an opt-out, and queues it for CiviCRM if it takes it. Returns
 * false, keeping nothing, when the source has told us this one before, or
 * the address is already opted out of the list.
 */
export async function recordOptOut(optOut: OptOut, db?: Queryable): Promise<boolean> {
  if (!db) return transaction((tx) => recordOptOut(optOut, tx));
  const address = normaliseAddress(optOut.address);
  const way = optOut.way ?? "email";
  const [row] = await query<{ id: number }>(
    `INSERT INTO opt_outs (address, list, way, source, source_ref, unsubscribed_at, recorded_by, how, message_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING RETURNING id::int AS id`,
    [
      address,
      optOut.list,
      way,
      optOut.source,
      optOut.sourceRef,
      optOut.unsubscribedAt,
      optOut.recordedBy?.toLowerCase() ?? null,
      optOut.how ?? null,
      optOut.messageId ?? null,
    ],
    db,
  );
  if (!row) return false;
  await queueOptOut(
    {
      id: row.id,
      address,
      list: optOut.list,
      way,
      source: optOut.source,
      at: optOut.unsubscribedAt,
      every: way !== "email" && (optOut.list === "all" || (await stopsEvery(address, way, db))),
    },
    db,
  );
  return true;
}

/** Whether a number has an open stop of every topic that goes by `way`, text or call. */
async function stopsEvery(address: string, way: Exclude<Way, "email">, db: Queryable): Promise<boolean> {
  const topics = TOPICS.filter((topic) => hasWay(topic, way));
  const [{ every }] = await query<{ every: boolean }>(
    `SELECT count(DISTINCT list) = $3 AS every FROM opt_outs
     WHERE address = $1 AND way = $2 AND list = ANY($4::text[]) AND resubscribed_at IS NULL`,
    [address, way, topics.length, topics],
    db,
  );
  return every;
}

/**
 * Closes the open opt-outs of `address` that `source` made, those whose
 * reference starts `refStart`, from `at`, as the person took them back
 * there. Says whether any were open.
 */
export async function recordSourceResume(
  address: string,
  source: OptOutSource,
  refStart: string,
  at: Date,
): Promise<boolean> {
  const rows = await query(
    `UPDATE opt_outs SET resubscribed_at = $4
     WHERE address = $1 AND source = $2 AND source_ref LIKE $3 AND resubscribed_at IS NULL AND unsubscribed_at <= $4
     RETURNING id`,
    [normaliseAddress(address), source, `${refStart}%`, at],
  );
  return rows.length > 0;
}

/**
 * Records an opt-out a staff member was told of, with how it was given, or
 * from a reply they read, now. Says whether it was new: false if the address
 * was already opted out of it. The audit log says who did it.
 */
export async function recordStaffOptOut(
  { address, way, list }: { address: string; way: Way; list: OptOutList },
  by: string,
  given: { how: string } | { replyId: number; messageId: number },
  db?: Queryable,
): Promise<boolean> {
  if (!db) return transaction((tx) => recordStaffOptOut({ address, way, list }, by, given, tx));
  const reply = "replyId" in given;
  const recorded = await recordOptOut(
    {
      address,
      way,
      list,
      source: reply ? "reply" : "staff",
      sourceRef: reply ? `reply ${given.replyId} ${list}` : randomUUID(),
      unsubscribedAt: now(),
      recordedBy: by,
      ...(reply ? { messageId: given.messageId } : { how: given.how }),
    },
    db,
  );
  if (recorded) {
    await logChange(
      by,
      "record opt-out",
      { address: normaliseAddress(address), list, way, ...(reply ? { how: "reply", replyId: given.replyId } : given) },
      db,
    );
  }
  return recorded;
}

/**
 * What takes an address off our Luma calendar: an opt-out of events by
 * email, or of every bulk email, told us on the contact preferences page, by an
 * email's links, or by staff. Not CiviCRM's or Luma's own, nor a complaint.
 * Every path that records one (offCalendarAfter) and the contacts pass's
 * retry (stillOnCalendar) go by these.
 */
const CALENDAR_LISTS: OptOutList[] = ["events", "bulk"];
const CALENDAR_SOURCES: OptOutSource[] = ["preferences", "link", "list-unsubscribe", "staff", "reply"];

/** An opt-out, as far as whether it takes the address off our Luma calendar goes. */
export type CalendarOptOut = Pick<OptOut, "address" | "list" | "way" | "source">;

/** Whether an opt-out takes its address off our Luma calendar. */
export const offCalendarFor = ({ way = "email", list, source }: CalendarOptOut): boolean =>
  way === "email" && CALENDAR_LISTS.includes(list) && CALENDAR_SOURCES.includes(source);

/** Closes the address's open opt-out from a topic by a way, email unless it says, if it has one. Returns whether it did. */
export async function recordResubscribe(
  address: string,
  list: Topic,
  resubscribedAt: Date,
  db?: Queryable,
  way: Way = "email",
): Promise<boolean> {
  const rows = await query(
    `UPDATE opt_outs SET resubscribed_at = $3
     WHERE address = $1 AND list = $2 AND way = $4 AND resubscribed_at IS NULL RETURNING id`,
    [normaliseAddress(address), list, resubscribedAt, way],
    db,
  );
  return rows.length > 0;
}

/** Closes the address's open opt-out of every bulk email, as the person lifted "No bulk emails". */
export async function recordBulkLift(address: string, db?: Queryable): Promise<void> {
  await query(
    `UPDATE opt_outs SET resubscribed_at = now()
     WHERE address = $1 AND list = 'bulk' AND way = 'email' AND resubscribed_at IS NULL`,
    [normaliseAddress(address)],
    db,
  );
}

/**
 * The start of the source reference of each stop one Stop everything on the
 * contact preferences page makes, followed by the group's own ID, which
 * Restart finds them by.
 */
export const STOP_ALL = "preferences stop-all";

/** The group (STOP_ALL and its ID) of the Stop everything whose "No bulk emails" holds the address now; null for none. */
export async function stopAllGroup(address: string, db?: Queryable): Promise<string | null> {
  const [row] = await query<{ ref: string }>(
    `SELECT source_ref AS ref FROM opt_outs
     WHERE address = $1 AND way = 'email' AND list = 'bulk' AND resubscribed_at IS NULL
       AND source = 'preferences' AND source_ref LIKE $2`,
    [normaliseAddress(address), `${STOP_ALL} %`],
    db,
  );
  return row ? row.ref.split(" ").slice(0, 3).join(" ") : null;
}

/** Closes the stops of texts and calls a Stop everything's group made, as Restart undoes it. */
export async function liftStopAllNumbers(group: string, db?: Queryable): Promise<void> {
  await query(
    `UPDATE opt_outs SET resubscribed_at = now()
     WHERE source = 'preferences' AND source_ref LIKE $1 AND way <> 'email' AND resubscribed_at IS NULL`,
    [`${group} %`],
    db,
  );
}

/**
 * For an activity row `a` that's an opt-out, as supporter_activity has
 * it: who recorded it and how the person told them, if staff did, and the
 * Thread of the email it came from, if any (how, recorded_by, thread). It
 * says nothing of whether we may contact them, which contact_permission()
 * answers.
 */
export const OPT_OUT_RECORDED = `
  SELECT o.how, o.recorded_by, '/staff/broadcasts/' || c.mailing_id || '/' || c.id AS thread
  FROM opt_outs o LEFT JOIN broadcast_messages c ON c.id = o.message_id
  WHERE a.kind = 'opted-out' AND o.address = a.detail AND o.list = a.title AND o.source = a.source
    AND o.unsubscribed_at = a.at
  LIMIT 1`;

/**
 * SQL for whether an opt-out was made from the broadcast copy `copy` (its
 * ID's column), such as by its unsubscribe link, a stop in WhatsApp, or its
 * reply recorded as one: they opted out because of it.
 */
export const optedOutFrom = (copy: string): string => `EXISTS (SELECT 1 FROM opt_outs o WHERE o.message_id = ${copy})`;

/**
 * SQL for how they opted out from the copy `copy`, by the first opt-out made
 * from it: its source, or a WhatsApp stop's kind after "whatsapp-"
 * (whatsapp-button, whatsapp-reply, whatsapp-refused); null for none.
 */
export const howOptedOutFrom = (copy: string): string =>
  `(SELECT CASE WHEN o.source = 'whatsapp' THEN 'whatsapp-' || split_part(o.source_ref, ' ', 1) ELSE o.source END
    FROM opt_outs o WHERE o.message_id = ${copy} ORDER BY o.unsubscribed_at, o.id LIMIT 1)`;

/** Whether an address has ever opted out of anything, which is our having it. */
export async function hasOptedOut(address: string): Promise<boolean> {
  const [row] = await query("SELECT 1 FROM opt_outs WHERE address = $1 LIMIT 1", [normaliseAddress(address)]);
  return Boolean(row);
}

/**
 * Brings the Luma calendar's opt-outs into line with a complete pass over
 * its contacts, begun at `passStartedAt`. Luma takes someone off its list
 * when they unsubscribe or we remove or block them, and puts them back as
 * they were when they follow again, and its webhook tells us of neither
 * every time. So an address whose contact the pass didn't list is opted
 * out, from now, unless it already is; and an open opt-out of Luma's begun
 * before the pass listed the address again is closed, from then. An opt-out
 * from anywhere else stays: it's ours to take them off the calendar
 * (stillOnCalendar), not their coming back. Returns how many opt-outs that
 * opened or closed.
 */
export async function recordContactsPass(passStartedAt: Date, db?: Queryable): Promise<number> {
  const gone = await query(
    `INSERT INTO opt_outs (address, list, source, source_ref, unsubscribed_at)
     SELECT DISTINCT ON (p.email) p.email, 'events', 'luma-contacts', p.user_id || ' ' || $2, now()
     FROM luma_people p
     WHERE p.contact_since IS NOT NULL AND (p.contact_seen_at IS NULL OR p.contact_seen_at < $1::timestamptz)
       AND NOT EXISTS (SELECT 1 FROM luma_people q WHERE q.email = p.email AND q.contact_seen_at >= $1::timestamptz)
     ORDER BY p.email, p.user_id
     ON CONFLICT DO NOTHING RETURNING id`,
    [passStartedAt, passStartedAt.toISOString()],
    db,
  );
  const back = await query(
    `UPDATE opt_outs o SET resubscribed_at = p.seen
     FROM (SELECT email, max(contact_seen_at) AS seen FROM luma_people
           WHERE contact_seen_at >= $1 GROUP BY email) p
     WHERE o.address = p.email AND o.list = 'events' AND o.way = 'email' AND o.resubscribed_at IS NULL
       AND o.unsubscribed_at < p.seen AND o.source IN ('luma-webhook', 'luma-contacts')
     RETURNING o.id`,
    [passStartedAt],
    db,
  );
  return gone.length + back.length;
}

/**
 * The addresses a pass over the calendar's contacts, begun at
 * `passStartedAt`, still listed though they have an open opt-out that takes
 * them off it (offCalendarFor): those whose taking off failed, or who
 * followed it again since.
 */
export async function stillOnCalendar(passStartedAt: Date, db?: Queryable): Promise<string[]> {
  const rows = await query<{ address: string }>(
    `SELECT DISTINCT o.address FROM opt_outs o JOIN luma_people p ON p.email = o.address
     WHERE o.list = ANY($2::text[]) AND o.way = 'email' AND o.resubscribed_at IS NULL
       AND o.source = ANY($3::text[]) AND p.contact_seen_at >= $1
     ORDER BY o.address`,
    [passStartedAt, CALENDAR_LISTS, CALENDAR_SOURCES],
    db,
  );
  return rows.map((row) => row.address);
}

/**
 * SQL that's true while any of the addresses in `emails` (an SQL array) has
 * opted out of the Luma calendar's emails: for whether a supporter is a
 * Luma contact now, which the supporters list works out as it's read.
 */
export function optedOutOfLuma(emails: string): string {
  return `EXISTS (SELECT 1 FROM opt_outs o
    WHERE o.list = 'events' AND o.way = 'email' AND o.resubscribed_at IS NULL AND o.address = ANY(${emails}))`;
}

/**
 * Brings the opt-outs into line with CiviCRM's lists, as its contacts that
 * a pull still returns have them (civicrm_contacts): an unsubscribe from
 * `newsletter` or `volunteer_updates` is an opt-out from the newsletter or
 * volunteering by email, from when the pull saw it; being on the list again
 * later, which only the person can do there, ends an opt-out begun before.
 * Returns how many opt-outs it opened or closed.
 */
export async function recordCivicrmLists(db?: Queryable): Promise<number> {
  const lists = `(VALUES ('newsletter', 'newsletter'), ('volunteer_updates', 'volunteering')) l (list, topic)`;
  const status = `CASE l.list WHEN 'newsletter' THEN c.newsletter ELSE c.volunteer_updates END`;
  const since = `CASE l.list WHEN 'newsletter' THEN c.newsletter_since ELSE c.volunteer_updates_since END`;
  const opened = await query(
    `INSERT INTO opt_outs (address, list, way, source, source_ref, unsubscribed_at)
     SELECT DISTINCT ON (c.email, l.topic) c.email, l.topic, 'email', 'civicrm',
       c.contact_id || ' ' || l.list || ' ' || ${since}, ${since}
     FROM civicrm_contacts c CROSS JOIN ${lists}
     WHERE c.gone_at IS NULL AND ${status} = 'unsubscribed'
     ORDER BY c.email, l.topic, c.contact_id
     ON CONFLICT DO NOTHING RETURNING id`,
    [],
    db,
  );
  const closed = await query(
    `UPDATE opt_outs o SET resubscribed_at = s.since
     FROM (SELECT c.email, l.topic, max(${since}) AS since FROM civicrm_contacts c CROSS JOIN ${lists}
           WHERE c.gone_at IS NULL AND ${status} = 'subscribed' GROUP BY c.email, l.topic) s
     WHERE o.address = s.email AND o.list = s.topic AND o.way = 'email' AND o.resubscribed_at IS NULL
       AND o.unsubscribed_at < s.since
     RETURNING o.id`,
    [],
    db,
  );
  return opened.length + closed.length;
}
