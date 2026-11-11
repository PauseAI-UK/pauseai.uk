import "server-only";
import { staffCopy } from "@/lib/content/staff-interface";
import type { CivicrmImportResult } from "@/lib/import-runs";
import { query, transaction, type Queryable } from "./db";
import { asRun } from "./import-runs";
import {
  civicrmKey,
  fetchContactsPage,
  lookUpContacts,
  PAGE_SIZE,
  type CivicrmContact,
} from "./outside-services/civicrm";
import { config } from "./config";
import { recordCivicrmLists } from "./opt-outs";
import { problem } from "./problems";
import { refreshSupportersList } from "./supporter-facts";
import { linkSupporters } from "./supporters";

// Copies Global's UK chapter contacts from CiviCRM into civicrm_contacts:
// hourly (/api/cron/import-civicrm) or when staff ask, each run in the
// import log as "import-civicrm". A run pulls every contact, a page at a
// time, and keeps each as CiviCRM told it, with when we saw each flag and
// list change. Each links to a supporter by its address, a new one if
// nobody has it. contact_permission() reads them. What CiviCRM's lists say
// becomes opt-outs from `civicrm`, and a new hold blocks the address. A
// contact a complete pull doesn't return has left the UK chapter, and is
// marked gone, unless the pull is so much smaller than the last that it's
// more likely CiviCRM's mistake. Between pulls, the members import looks up
// each new member's address (lookUpNewMembers). Nothing here writes to
// CiviCRM.

const JOB = "import-civicrm";

/** Far more pages than the chapter has, so a page that never comes up short can't pull forever. */
const MAX_PAGES = 100;

/** How much smaller than the last a complete pull can be before nobody is marked gone from it. */
const MOST_GONE = 0.05;

/** Every UK chapter contact, a page at a time, to the first short page. */
async function pullContacts(key: string): Promise<CivicrmContact[]> {
  const contacts: CivicrmContact[] = [];
  for (let pages = 1; ; pages++) {
    if (pages > MAX_PAGES) throw new Error(`CiviCRM's contacts ran past ${MAX_PAGES} pages`);
    const page = await fetchContactsPage(key, contacts.at(-1)?.contactId ?? 0);
    contacts.push(...page);
    if (page.length < PAGE_SIZE) return contacts;
  }
}

/** The columns a contact's flags and lists are kept in, each with its `_since`. */
const FIELDS = [
  "on_hold",
  "no_bulk_email",
  "do_not_email",
  "do_not_phone",
  "do_not_sms",
  "newsletter",
  "volunteer_updates",
] as const;

/**
 * Upserts the contacts, but none erased, each returned now: a new one with
 * every value from now, a changed one with each value that changed from
 * now, and one marked gone back. Returns how many were added and how many
 * changed.
 */
async function upsertContacts(contacts: CivicrmContact[], db: Queryable): Promise<{ added: number; changed: number }> {
  const sets = FIELDS.map(
    (field) =>
      `${field} = EXCLUDED.${field},
       ${field}_since = CASE WHEN c.${field} = EXCLUDED.${field} THEN c.${field}_since ELSE now() END`,
  ).join(",\n");
  const kept = ["airtable_id", "email", ...FIELDS];
  const rows = await query<{ added: boolean }>(
    `INSERT INTO civicrm_contacts AS c (contact_id, ${kept.join(", ")}, ${FIELDS.map((f) => `${f}_since`).join(", ")})
     SELECT u.*, ${FIELDS.map(() => "now()").join(", ")}
     FROM unnest($1::bigint[], $2::text[], $3::text[], $4::boolean[], $5::boolean[], $6::boolean[], $7::boolean[],
       $8::boolean[], $9::text[], $10::text[]) AS u (contact_id, ${kept.join(", ")})
     WHERE u.contact_id NOT IN (SELECT contact_id FROM civicrm_erased)
     ON CONFLICT (contact_id) DO UPDATE SET airtable_id = EXCLUDED.airtable_id, email = EXCLUDED.email,
       ${sets}, gone_at = NULL
     WHERE (${kept.map((f) => `c.${f}`).join(", ")}, c.gone_at)
       IS DISTINCT FROM (${kept.map((f) => `EXCLUDED.${f}`).join(", ")}, NULL)
     RETURNING xmax = 0 AS added`,
    [
      contacts.map((c) => c.contactId),
      contacts.map((c) => c.airtableId),
      contacts.map((c) => c.email),
      contacts.map((c) => c.onHold),
      contacts.map((c) => c.noBulkEmail),
      contacts.map((c) => c.doNotEmail),
      contacts.map((c) => c.doNotPhone),
      contacts.map((c) => c.doNotSms),
      contacts.map((c) => c.newsletter),
      contacts.map((c) => c.volunteerUpdates),
    ],
    db,
  );
  const added = rows.filter((row) => row.added).length;
  return { added, changed: rows.length - added };
}

/**
 * Brings the opt-outs and blocks into line with the contacts: what
 * CiviCRM's lists say, as opt-outs (recordCivicrmLists), and a hold seen in
 * this transaction blocks the address, unless it's blocked already.
 * Returns how many opt-outs it opened or closed, and how many addresses it
 * blocked.
 */
async function applyContacts(db: Queryable): Promise<{ optOuts: number; blocked: number }> {
  const optOuts = await recordCivicrmLists(db);
  const holds = await query<{ email: string; contactId: string }>(
    `SELECT DISTINCT ON (email) email, contact_id::text AS "contactId" FROM civicrm_contacts
     WHERE on_hold AND on_hold_since = now() AND gone_at IS NULL ORDER BY email, contact_id`,
    [],
    db,
  );
  let blocked = 0;
  for (const hold of holds) {
    const made = await query(
      `WITH problem AS (
         INSERT INTO email_problems (address, kind, reason, can_reset, details)
         VALUES ($1, 'hold', $2, true, jsonb_build_object('contactId', $3::bigint)) RETURNING id)
       INSERT INTO email_blocks (address, problem_id) SELECT $1, id FROM problem
       ON CONFLICT (address) DO NOTHING RETURNING address`,
      [hold.email, staffCopy.emails.holdReason, hold.contactId],
      db,
    );
    blocked += made.length;
  }
  return { optOuts, blocked };
}

/**
 * Marks gone every contact the complete pull of `pulled` didn't return,
 * unless it returned more than MOST_GONE fewer than the `before` there
 * were, which is reported instead. Returns how many it marked, or null if
 * it held.
 */
async function markGone(pulled: number[], before: number, db: Queryable): Promise<number | null> {
  if (pulled.length < before * (1 - MOST_GONE)) {
    problem(staffCopy.problems.job.civicrmTooFew, `${pulled.length} returned, ${before} before`);
    return null;
  }
  const rows = await query(
    `UPDATE civicrm_contacts SET gone_at = now()
     WHERE gone_at IS NULL AND NOT (contact_id = ANY($1::bigint[])) RETURNING contact_id`,
    [pulled],
    db,
  );
  return rows.length;
}

/** Runs the import, keeping the run. A failure, of CiviCRM's or the database's, rolls the run back. */
export async function importCivicrm(startedBy: string): Promise<CivicrmImportResult> {
  const { result } = await asRun(JOB, startedBy, async () => {
    const contacts = await pullContacts(civicrmKey());
    return transaction(async (db) => {
      const [{ before }] = await query<{ before: number }>(
        "SELECT count(*)::int AS before FROM civicrm_contacts WHERE gone_at IS NULL",
        [],
        db,
      );
      const { added, changed } = await upsertContacts(contacts, db);
      const gone = await markGone(
        contacts.map((c) => c.contactId),
        before,
        db,
      );
      const result: CivicrmImportResult = {
        contacts: contacts.length,
        added,
        changed,
        gone: gone ?? 0,
        ...(gone === null && { held: true }),
        ...(await applyContacts(db)),
      };
      const { supportersAdded, linked } = await linkSupporters(db);
      if (linked > 0) {
        await refreshSupportersList(db);
        Object.assign(result, { supportersAdded, linked });
      }
      const anything = added + changed + result.gone + result.optOuts + result.blocked + linked;
      return { status: anything > 0 ? "ok" : "unchanged", result } as const;
    });
  });
  return result;
}

/**
 * Looks up in CiviCRM the addresses of members first seen in the last day
 * that no pull has returned, as someone who just joined isn't in the last
 * one, and keeps any it finds as a pull would. Nothing without the key, and
 * CiviCRM failing is a problem of the run it's in, not a failure. Returns
 * how many contacts it found.
 */
export async function lookUpNewMembers(db: Queryable): Promise<number> {
  const rows = await query<{ email: string }>(
    `SELECT DISTINCT m.email FROM members m
     WHERE m.removed_at IS NULL AND m.first_seen_at > now() - interval '1 day'
       AND NOT EXISTS (SELECT 1 FROM civicrm_contacts c WHERE c.airtable_id = m.id OR c.email = m.email)
     ORDER BY m.email`,
    [],
    db,
  );
  if (rows.length === 0 || !config.civicrmChapterKey) return 0;
  let found: CivicrmContact[];
  try {
    found = await lookUpContacts(
      civicrmKey(),
      rows.map((row) => row.email),
    );
  } catch (error) {
    problem(staffCopy.problems.job.civicrmLookupFailed, error);
    return 0;
  }
  if (found.length === 0) return 0;
  await upsertContacts(found, db);
  await applyContacts(db);
  return found.length;
}
