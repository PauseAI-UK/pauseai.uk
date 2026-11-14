import "server-only";
import { staffCopy } from "@/lib/content/staff-interface";
import type { CivicrmImportResult } from "@/lib/import-runs";
import { query, transaction, type Queryable } from "./db.server";
import { asRun } from "./import-runs.server";
import { civicrmKey, fetchContactsPage, PAGE_SIZE, type CivicrmContact } from "./outside-services/civicrm.server";
import { sendCivicrmUpdates } from "./civicrm-updates.server";
import { recordCivicrmLists } from "@/lib/supporters/opt-outs.server";
import { problem } from "./problems.server";
import { resendAfterFix } from "./relays.server";
import { refreshSupporterFacts, refreshSupportersList } from "@/lib/supporters/facts.server";
import { linkSupporters } from "@/lib/supporters/records.server";

// Copies Global's UK chapter contacts from CiviCRM into civicrm_contacts:
// hourly (/api/cron/import-civicrm) or when staff ask, each run in the
// import log as "import-civicrm". A run pulls every contact, a page at a
// time, and keeps each as CiviCRM told it: its member details, and its
// flags and lists, with when we saw each change. A member is a contact a
// pull returns. Each links to a supporter by its address, a new one if
// nobody has it. contact_permission() reads them. What CiviCRM's lists say
// becomes opt-outs from `civicrm`, and a new hold blocks the address. A
// contact a complete pull doesn't return has left the UK chapter, and is
// marked gone, unless the pull is so much smaller than the last that it's
// more likely CiviCRM's mistake. Before it pulls, a run sends CiviCRM our
// opt-outs waiting for it (civicrm-updates.server.ts).

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

/** The columns a contact's member details are kept in, as CiviCRM gave them, with no `_since`. */
const DETAILS = ["first_name", "last_name", "city", "postal_code", "joined_date", "intent", "phone"] as const;

/**
 * Upserts the contacts, but none erased, each returned now: a new one with
 * every value from now, a changed one with each flag or list that changed
 * from now, and one marked gone back. Returns how many were added and how
 * many changed.
 */
async function upsertContacts(contacts: CivicrmContact[], db: Queryable): Promise<{ added: number; changed: number }> {
  const sets = [
    ...["airtable_id", "email", ...DETAILS].map((field) => `${field} = EXCLUDED.${field}`),
    ...FIELDS.map(
      (field) =>
        `${field} = EXCLUDED.${field},
       ${field}_since = CASE WHEN c.${field} = EXCLUDED.${field} THEN c.${field}_since ELSE now() END`,
    ),
  ].join(",\n");
  const kept = ["airtable_id", "email", ...DETAILS, ...FIELDS];
  const rows = await query<{ added: boolean }>(
    `INSERT INTO civicrm_contacts AS c (contact_id, ${kept.join(", ")}, ${FIELDS.map((f) => `${f}_since`).join(", ")})
     SELECT u.*, ${FIELDS.map(() => "now()").join(", ")}
     FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[], $8::date[],
       $9::text[], $10::text[], $11::boolean[], $12::boolean[], $13::boolean[], $14::boolean[], $15::boolean[],
       $16::text[], $17::text[]) AS u (contact_id, ${kept.join(", ")})
     WHERE u.contact_id NOT IN (SELECT contact_id FROM civicrm_erased)
     ON CONFLICT (contact_id) DO UPDATE SET ${sets}, gone_at = NULL
     WHERE (${kept.map((f) => `c.${f}`).join(", ")}, c.gone_at)
       IS DISTINCT FROM (${kept.map((f) => `EXCLUDED.${f}`).join(", ")}, NULL)
     RETURNING xmax = 0 AS added`,
    [
      contacts.map((c) => c.contactId),
      contacts.map((c) => c.airtableId),
      contacts.map((c) => c.email),
      contacts.map((c) => c.firstName),
      contacts.map((c) => c.lastName),
      contacts.map((c) => c.city),
      contacts.map((c) => c.postalCode),
      contacts.map((c) => c.joinedDate),
      contacts.map((c) => c.intent),
      contacts.map((c) => c.phone),
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
 * CiviCRM's lists say, as opt-outs (recordCivicrmLists); a hold seen in
 * this transaction blocks the address, unless it's blocked already; and a
 * hold lifted in it takes away the block a hold made, unless another of the
 * address's contacts is still on hold. Returns how many opt-outs it opened
 * or closed, how many addresses it blocked, and those it unblocked.
 */
async function applyContacts(db: Queryable): Promise<{ optOuts: number; blocked: number; unblocked: string[] }> {
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
  const unblocked = await query<{ address: string }>(
    `DELETE FROM email_blocks b USING email_problems p
     WHERE p.id = b.problem_id AND p.kind = 'hold'
       AND EXISTS (SELECT 1 FROM civicrm_contacts c
                   WHERE c.email = b.address AND NOT c.on_hold AND c.on_hold_since = now() AND c.gone_at IS NULL)
       AND NOT EXISTS (SELECT 1 FROM civicrm_contacts c WHERE c.email = b.address AND c.on_hold AND c.gone_at IS NULL)
     RETURNING b.address`,
    [],
    db,
  );
  return { optOuts, blocked, unblocked: unblocked.map((row) => row.address) };
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
  let unblocked: string[] = [];
  const { result } = await asRun(JOB, startedBy, async () => {
    const key = civicrmKey();
    // Ours first, so the pull already has them.
    const updates = await sendCivicrmUpdates(key);
    const sentAny = updates.sent + updates.refused + updates.unanswered > 0;
    const contacts = await pullContacts(key);
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
      const applied = await applyContacts(db);
      unblocked = applied.unblocked;
      const result: CivicrmImportResult = {
        contacts: contacts.length,
        added,
        changed,
        gone: gone ?? 0,
        ...(gone === null && { held: true }),
        optOuts: applied.optOuts,
        blocked: applied.blocked,
        ...(unblocked.length > 0 && { unblocked: unblocked.length }),
        ...(sentAny && { updates }),
      };
      const { supportersAdded, linked } = await linkSupporters(db);
      if (linked > 0) Object.assign(result, { supportersAdded, linked });
      // A contact added, changed or gone changes what the list shows of its
      // supporter (a name, place, when they joined, the Member badge), as
      // linking one does.
      if (added + changed + result.gone + linked > 0) {
        await refreshSupporterFacts(db);
        await refreshSupportersList(db);
      }
      const anything =
        added + changed + result.gone + result.optOuts + result.blocked + unblocked.length + linked + updates.sent;
      return { status: anything > 0 ? "ok" : "unchanged", result } as const;
    });
  });
  // Once committed, as when staff unblock: what waited for an address goes.
  for (const address of unblocked) await resendAfterFix({ address });
  return result;
}
