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

/** The copy to a number whose refusal by WhatsApp marked it: when, and the broadcast it was of. */
export type NumberRefusal = {
  number: string;
  at: Date;
  copy: { id: number; broadcast: number; title: string };
};

/**
 * The copy whose refusal marked each of `numbers`, at when it was marked.
 * The copies skipped for the mark aren't listed: the mark's count of them
 * (NumberBlock's `refused`) says how many. A number whose copy has been
 * deleted has none.
 */
export async function numberRefusals(numbers: string[]): Promise<NumberRefusal[]> {
  return query<NumberRefusal>(
    `SELECT u.number, u.at, json_build_object('id', c.id, 'broadcast', g.id, 'title', g.title) AS copy
     FROM whatsapp_unreachable u JOIN broadcast_messages c ON c.id = u.message_id JOIN mailings g ON g.id = c.mailing_id
     WHERE u.number = ANY($1)`,
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
