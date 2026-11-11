import "server-only";
import type { Topic, Way } from "@/lib/contact-permissions";
import { query, type Queryable } from "./db";

// Each time an address or number opted out of a topic by a way, and when it
// opted back in, if it has (opt_outs). It's opted out while it has an open
// row, one at most per topic and way. Keyed by address, not person: an
// unsubscribe can arrive before we know whose address it is. Luma's
// calendar emails are events by email. contact_permission() reads it.

/** What can record an opt-out: Luma's webhook, a full pass over the calendar's contacts, or CiviCRM's lists. */
export type OptOutSource = "luma-webhook" | "luma-contacts" | "civicrm";

export type OptOut = {
  address: string;
  /** The topic, opted out of by `way`, email unless it says. */
  list: Topic;
  way?: Way;
  source: OptOutSource;
  /** The source's own ID for it, so the same news told twice is kept once. */
  sourceRef: string;
  unsubscribedAt: Date;
};

/** The address as the table keeps it: trimmed and lowercased. */
export function normaliseAddress(address: string): string {
  return address.trim().toLowerCase();
}

/**
 * Records an opt-out. Returns false, keeping nothing, when the source has
 * told us this one before, or the address is already opted out of the list.
 */
export async function recordOptOut(optOut: OptOut, db?: Queryable): Promise<boolean> {
  const rows = await query(
    `INSERT INTO opt_outs (address, list, way, source, source_ref, unsubscribed_at)
     VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING RETURNING id`,
    [
      normaliseAddress(optOut.address),
      optOut.list,
      optOut.way ?? "email",
      optOut.source,
      optOut.sourceRef,
      optOut.unsubscribedAt,
    ],
    db,
  );
  return rows.length > 0;
}

/** Closes the address's open opt-out from a topic by email, if it has one. Returns whether it did. */
export async function recordResubscribe(
  address: string,
  list: Topic,
  resubscribedAt: Date,
  db?: Queryable,
): Promise<boolean> {
  const rows = await query(
    `UPDATE opt_outs SET resubscribed_at = $3
     WHERE address = $1 AND list = $2 AND way = 'email' AND resubscribed_at IS NULL RETURNING id`,
    [normaliseAddress(address), list, resubscribedAt],
    db,
  );
  return rows.length > 0;
}

/**
 * Brings the Luma calendar's opt-outs into line with a complete pass over
 * its contacts, begun at `passStartedAt`. Luma takes someone off its list
 * when they unsubscribe or we remove or block them, and puts them back as
 * they were when they follow again, and its webhook tells us of neither
 * every time. So an address whose contact the pass didn't list is opted
 * out, from now, unless it already is; and an open opt-out begun before the
 * pass listed the address again is closed, from then. Returns how many
 * opt-outs that opened or closed.
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
       AND o.unsubscribed_at < p.seen
     RETURNING o.id`,
    [passStartedAt],
    db,
  );
  return gone.length + back.length;
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
