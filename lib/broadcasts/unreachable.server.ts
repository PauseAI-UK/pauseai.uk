import "server-only";
import { logChange } from "@/lib/server/audit.server";
import { query, transaction } from "@/lib/server/db.server";

// The numbers WhatsApp couldn't deliver to (whatsapp_unreachable). Its
// error for that (131026) means the number isn't on WhatsApp, or the person
// hasn't accepted WhatsApp's latest terms, or their app is too old, without
// saying which, so a mark lasts UNREACHABLE_MONTHS: the next text after that
// tries the number again, and marks it again if WhatsApp still refuses.

/** How long a number's mark stops texts to it. */
const UNREACHABLE_MONTHS = 2;

/** Whether the mark `u` still stops texts. */
const STILL_STOPS = `u.at > now() - make_interval(months => ${UNREACHABLE_MONTHS})`;

/** Marks a number as not on WhatsApp, from the copy that found it, so texts skip it for UNREACHABLE_MONTHS. */
export async function markUnreachable(number: string, copyId: number): Promise<void> {
  await query(
    `INSERT INTO whatsapp_unreachable (number, message_id) VALUES ($1, $2)
     ON CONFLICT (number) DO UPDATE SET at = now(), message_id = excluded.message_id`,
    [number, copyId],
  );
}

/** Which of `numbers` texts skip, as WhatsApp couldn't deliver to them in the last UNREACHABLE_MONTHS. */
export async function unreachable(numbers: string[]): Promise<Set<string>> {
  const rows = await query<{ number: string }>(
    `SELECT u.number FROM whatsapp_unreachable u WHERE u.number = ANY($1) AND ${STILL_STOPS}`,
    [numbers],
  );
  return new Set(rows.map((row) => row.number));
}

/** A number WhatsApp couldn't deliver to, for the staff interface. */
export type NumberBlock = {
  number: string;
  /** When WhatsApp last refused it. */
  since: Date;
  /** When texts try it again, past or to come. */
  triesFrom: Date;
  /** The copy WhatsApp refused, and its broadcast, unless it's been deleted. */
  copy: { id: number; broadcast: number; title: string } | null;
  /** The supporters texts to this number went to, by the name the supporters list gives them. */
  supporters: { id: number; name: string | null }[];
  /** Copies skipped for it: every one but the copy WhatsApp refused. */
  refused: number;
};

/** The marks on `numbers`, as NumberBlock, in no order. */
export async function numberBlocks(numbers: string[]): Promise<NumberBlock[]> {
  return query<NumberBlock>(
    `SELECT u.number, u.at AS since, u.at + make_interval(months => ${UNREACHABLE_MONTHS}) AS "triesFrom",
       (SELECT json_build_object('id', c.id, 'broadcast', g.id, 'title', g.title)
        FROM broadcast_messages c JOIN mailings g ON g.id = c.mailing_id WHERE c.id = u.message_id) AS copy,
       (SELECT coalesce(json_agg(json_build_object('id', x.id, 'name', x.name) ORDER BY x.name COLLATE english NULLS LAST, x.id), '[]')
        FROM (SELECT DISTINCT c.supporter_id::int AS id, l.name
              FROM broadcast_messages c LEFT JOIN supporters_list l ON l.id = c.supporter_id
              WHERE c.address = u.number) x) AS supporters,
       (SELECT count(*)::int FROM broadcast_messages c
        WHERE c.address = u.number AND c.skip_reason = 'not-on-whatsapp' AND c.id IS DISTINCT FROM u.message_id) AS refused
     FROM whatsapp_unreachable u WHERE u.number = ANY($1)`,
    [numbers],
  );
}

/** A copy to a number that WhatsApp refused, or that was skipped as it had: when, and the broadcast it was of. */
export type NumberEvent = {
  number: string;
  at: Date;
  /** Whether WhatsApp refused this copy, rather than it being skipped for an earlier refusal. */
  refused: boolean;
  copy: { id: number; broadcast: number; title: string };
};

/**
 * Every copy to `numbers` WhatsApp refused, or skipped as it had: the
 * copy whose refusal marked the number when it was marked, and each one
 * skipped when its broadcast was due, as a skip keeps no time of its own;
 * but one made after the refused copy no sooner than the refusal, as it
 * can only have been skipped after it.
 */
export async function numberEvents(numbers: string[]): Promise<NumberEvent[]> {
  return query<NumberEvent>(
    `SELECT c.address AS number, CASE WHEN c.id = u.message_id THEN u.at
         WHEN c.id > u.message_id THEN greatest(coalesce(g.due_at, g.created_at), u.at)
         ELSE coalesce(g.due_at, g.created_at) END AS at,
       c.id IS NOT DISTINCT FROM u.message_id AS refused, json_build_object('id', c.id, 'broadcast', g.id, 'title', g.title) AS copy
     FROM broadcast_messages c JOIN mailings g ON g.id = c.mailing_id
       LEFT JOIN whatsapp_unreachable u ON u.number = c.address
     WHERE c.address = ANY($1) AND c.skip_reason = 'not-on-whatsapp'
     ORDER BY at DESC, c.id DESC`,
    [numbers],
  );
}

/**
 * Forgets that WhatsApp couldn't deliver to a number, so the next text
 * tries it, and logs who did it and why, as unblocking an address is.
 * Refused without a note of why. Returns whether there was a mark to forget.
 */
export async function forgetUnreachable(number: string, staff: string, note: string): Promise<boolean> {
  if (!note.trim()) return false;
  return transaction(async (db) => {
    const deleted = await query("DELETE FROM whatsapp_unreachable WHERE number = $1 RETURNING number", [number], db);
    if (deleted.length) await logChange(staff, "unblock address", { address: number, note }, db);
    return deleted.length > 0;
  });
}
