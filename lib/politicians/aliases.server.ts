import "server-only";
import { isSharedInbox, keepsPoliticianThreads, nameParts, type PoliticianBook } from "@/lib/letters/one-off";
import { auditActions, logChange } from "@/lib/server/audit.server";
import { config } from "@/lib/server/config.server";
import { query, transaction } from "@/lib/server/db.server";
import { gmailAccess } from "@/lib/email/gmail-access.server";
import { ONE_OFF_HEADERS, isHeld, keepIfPoliticianThread } from "@/lib/letters/one-off-emails.server";
import { relinkOneOffs } from "@/lib/letters/one-off-relink.server";
import { GmailError, gmailMessageHeaders, searchGmail, unlessGone } from "@/lib/server/outside-services/gmail.server";
import { connectedAccounts, politicianBook } from "@/lib/letters/book.server";
import type { AddressSearch } from "@/lib/import-run-types";
import { problem } from "@/lib/server/problems.server";
import { politicianProblems } from "./copy";

// A politician's aliases: every address and domain that says a message is
// theirs, and where each came from, for the foot of their page; and the
// addresses staff add by hand, such as a personal Gmail.

/**
 * Where an address in politician_addresses came from: Parliament's list, the
 * threads their office is in, or staff; or an office's that staff rejected.
 */
export type AddressSource = "parliament" | "office" | "staff" | "rejected";

/** An address staff added: who, when, and their note of why (empty for one from before notes). */
export type AddedAddress = { address: string; addedBy: string; at: Date; note: string };

/**
 * Where a politician's email came from: the staff member who set it last,
 * when, and their note of why (empty for one from before notes); or else
 * their body's list, which has it; or else Airtable, which the policy team
 * kept, for one its sync set or copied over; or null for none of those.
 */
export type EmailSource =
  { by: "staff"; staff: string; at: Date; note: string } | { by: "body" } | { by: "airtable" } | null;

/** Every address and domain that's a politician's, by where it came from. */
export type PoliticianAliases = {
  /** Their email, which letters go to. */
  email: string | null;
  /** Where their email came from, if known (EmailSource). */
  emailSource: EmailSource;
  /** Emails they had before, from the audit log's edits. */
  past: string[];
  /** Those Parliament's Members API lists. */
  parliament: string[];
  /** Their office's, from the threads it's in. */
  office: string[];
  /** Those staff added. */
  added: AddedAddress[];
  /** The domains of their own. */
  domains: string[];
  /** Examples of the parliament addresses their name and seat make (addressForms). */
  forms: string[];
};

/** A house's parliament addresses: the domain, and the mark after a name. */
const HOUSE_FORMS: Record<string, { mark: string; domain: string }> = {
  commons: { mark: ".mp", domain: "parliament.uk" },
  "scottish-parliament": { mark: ".msp", domain: "parliament.scot" },
  senedd: { mark: "", domain: "senedd.wales" },
  "ni-assembly": { mark: "", domain: "mla.niassembly.gov.uk" },
};

/** The forms of parliament address the book gives a politician, as examples: those their name and seat make, if theirs alone. */
export function formExamples(
  book: PoliticianBook,
  politician: { id: number; name: string; house: string; constituency: string | null },
): string[] {
  const house = HOUSE_FORMS[politician.house];
  if (!house) return [];
  const parts = nameParts(politician.name);
  const names = (parts?.surnames ?? [])
    .filter((surname) => book.forms.get(`name:${parts!.first}${surname}`) === politician.id)
    .map((surname) => `${parts!.first}.${surname}${house.mark}@${house.domain}`);
  const seat = politician.constituency?.toLowerCase().replace(/[^a-z]/g, "");
  const seats = seat && book.forms.get(`seat:${seat}`) === politician.id ? [`${seat}.mp@${house.domain}`] : [];
  return [...names, ...seats];
}

/** A politician's aliases. */
export async function politicianAliases(politician: {
  id: number;
  name: string;
  house: string;
  constituency: string | null;
  email: string | null;
}): Promise<PoliticianAliases> {
  const [[setBy], [record], past, listed, domains, book] = await Promise.all([
    // The last entry that made their email what it is, adding them or editing them: a staff member's, logged by
    // their email, Airtable's sync's, or an import's.
    query<{ actor: string; at: Date; note: string | null }>(
      `SELECT actor, at, details->>'note' AS note FROM audit_log
       WHERE action IN (${auditActions("edit politician", "add politician")}) AND (details->>'id')::bigint = $1
         AND lower(coalesce(details->'changed'->'email'->>1, details->>'email')) = lower($2)
       ORDER BY id DESC LIMIT 1`,
      [politician.id, politician.email],
    ),
    query<{ fromAirtable: boolean }>(
      `SELECT airtable_id IS NOT NULL AS "fromAirtable" FROM notable_people WHERE id = $1`,
      [politician.id],
    ),
    query<{ address: string }>(
      `SELECT DISTINCT address FROM (
         SELECT lower(jsonb_array_elements_text(details->'changed'->'email')) AS address
         FROM audit_log WHERE action = ${auditActions("edit politician")} AND (details->>'id')::bigint = $1
           AND details->'changed' ? 'email'
       ) emails WHERE address IS NOT NULL ORDER BY address`,
      [politician.id],
    ),
    // With the note of why on the entry that added it, for one staff added.
    query<{ address: string; source: AddressSource; addedBy: string | null; at: Date; note: string | null }>(
      `SELECT a.address, a.source, a.added_by AS "addedBy", a.created_at AS at,
         (SELECT l.details->>'note' FROM audit_log l
          WHERE l.action = ${auditActions("add politician address")}
            AND (l.details->>'politicianId')::bigint = a.notable_person_id AND l.details->>'address' = a.address
          ORDER BY l.id DESC LIMIT 1) AS note
       FROM politician_addresses a WHERE a.notable_person_id = $1 ORDER BY a.address`,
      [politician.id],
    ),
    query<{ domain: string }>("SELECT domain FROM politician_domains WHERE notable_person_id = $1 ORDER BY domain", [
      politician.id,
    ]),
    politicianBook(),
  ]);
  const email = politician.email?.toLowerCase() ?? null;
  const from = (source: AddressSource) =>
    listed.filter((row) => row.source === source && row.address !== email).map((row) => row.address);
  const emailSource: EmailSource = setBy?.actor.includes("@")
    ? { by: "staff", staff: setBy.actor, at: setBy.at, note: setBy.note ?? "" }
    : listed.some((row) => row.source === "parliament" && row.address === email)
      ? { by: "body" }
      : // Airtable's sync logged as "sync"; a politician copied from Airtable before the audit log has no entry.
        email && (setBy ? setBy.actor === "sync" : record?.fromAirtable)
        ? { by: "airtable" }
        : null;
  return {
    email: politician.email,
    emailSource,
    // Only those not listed otherwise, as by their body, which says more.
    past: past
      .map((row) => row.address)
      .filter(
        (address) =>
          address !== email &&
          address.includes("@") &&
          !listed.some((row) => row.address === address && row.source !== "rejected"),
      ),
    parliament: from("parliament"),
    office: from("office"),
    added: listed
      .filter((row) => row.source === "staff")
      .map(({ address, addedBy, at, note }) => ({ address, addedBy: addedBy!, at, note: note ?? "" })),
    domains: domains.map((row) => row.domain),
    // Only forms not already listed as one of theirs.
    forms: formExamples(book, politician).filter(
      (form) => form !== email && !listed.some((row) => row.address === form && row.source !== "rejected"),
    ),
  };
}

/** How many messages the search for an address keeps from each mailbox, at most. */
const SEARCH_AT_MOST = 50;

/** Whether Gmail refused for now, as it does past its limit a minute: the search carries on next time. */
const refusedForNow = (error: unknown) => error instanceof GmailError && error.kind === "rate-limited";

/**
 * Keeps what the mailboxes we keep hold with an address in it, anywhere:
 * the messages the regular read passed over before the address was known,
 * but for those kept already. Stops at `stop` (a time from Date.now()),
 * between messages; gives whether it got through them all.
 */
async function searchMailboxes(address: string, stop: number): Promise<boolean> {
  for (const account of (await connectedAccounts()).filter(keepsPoliticianThreads)) {
    const token = await gmailAccess(account);
    const found = await searchGmail(token, `"${address}"`, SEARCH_AT_MOST);
    const kept = await query<{ id: string }>(
      "SELECT gmail_message_id AS id FROM one_off_messages WHERE account = $1 AND gmail_message_id = ANY($2::text[])",
      [account, found],
    );
    for (const id of found.filter((id) => !kept.some((row) => row.id === id))) {
      if (Date.now() >= stop) return false;
      const message = await gmailMessageHeaders(token, id, ONE_OFF_HEADERS).catch(unlessGone);
      // Most it finds are copies of what another mailbox gave us: those are passed over by their headers alone.
      if (message && !(await isHeld(account, message)))
        await keepIfPoliticianThread(account, token, message, account === config.policyInbox);
    }
  }
  return true;
}

/** How long past `until` the search for one address may go on, before it stops and carries on next time. */
const FINISH_MS = 8_000;

/**
 * Searches the mailboxes for each address staff added and nobody has
 * searched for yet, oldest first, starting on another until `until` (a time
 * from Date.now()) and stopping partway through one a little after it: part
 * of the regular read of Gmail. An address is marked searched once it's done.
 * Any failure is a problem of the run, with Gmail's words. If Gmail refused
 * for now, or the time ran out, which the result says, the search stops and
 * the address is searched again next time, passing over what's kept; after
 * any other failure, the address is marked searched all the same, so it
 * isn't tried every five minutes, and staff can add it again.
 */
export async function searchAddedAddresses(until: number): Promise<AddressSearch> {
  const waiting = await query<{ address: string; id: number }>(
    `SELECT address, notable_person_id::int AS id FROM politician_addresses
     WHERE source = 'staff' AND searched_at IS NULL ORDER BY created_at, address`,
  );
  const messages = async () => (await query<{ n: number }>("SELECT count(*)::int AS n FROM one_off_messages"))[0].n;
  const before = await messages();
  let searched = 0;
  let stopped: AddressSearch["stopped"];
  for (const { address, id } of waiting) {
    if (Date.now() >= until) {
      stopped = { by: "time" };
      break;
    }
    try {
      if (!(await searchMailboxes(address, until + FINISH_MS))) {
        stopped = { by: "time" };
        break;
      }
    } catch (error) {
      problem(politicianProblems.addressNotSearched({ politician: id }), error);
      if (refusedForNow(error)) break;
    }
    await query(
      "UPDATE politician_addresses SET searched_at = now() WHERE address = $1 AND notable_person_id = $2 AND source = 'staff'",
      [address, id],
    );
    searched++;
  }
  return {
    searched,
    kept: (await messages()) - before,
    waiting: waiting.length - searched,
    ...(stopped && { stopped }),
  };
}

/** Why an address wasn't added: what was typed, or, "gone", a politician no longer there. */
export type AddRefusal = "invalid" | "exists" | "shared" | "note" | "gone";

/** What adding an address did, or why it didn't. */
export type AddResult = { added: true } | { added: false; why: AddRefusal };

/**
 * Adds an address to a politician's by hand, with a note of why, logged, and relinks every
 * thread, so that those with it show on their page. The mailboxes are
 * searched for its earlier mail by the regular read of Gmail
 * (searchAddedAddresses), not while staff wait. Gives what happened.
 */
export async function addPoliticianAddress(
  politicianId: number,
  given: string,
  by: string,
  givenNote: string,
): Promise<AddResult> {
  const address = given.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { added: false, why: "invalid" };
  if (isSharedInbox(address)) return { added: false, why: "shared" };
  // The audit log refuses a staff member's address without a note of why too (audit_log_edit_note).
  const note = givenNote.trim();
  if (!note) return { added: false, why: "note" };
  const [who] = await query<{
    id: number;
    name: string;
    house: string;
    constituency: string | null;
    email: string | null;
  }>(
    `SELECT n.id::int AS id, n.name, p.house, p.constituency, n.email FROM notable_people n
     JOIN politicians p ON p.id = n.id WHERE n.id = $1`,
    [politicianId],
  );
  if (!who) return { added: false, why: "gone" };
  // Already theirs, however: their email, a past one, one their body lists, their office's, or a form of their name.
  const known = await politicianAliases(who);
  const theirs = [
    known.email?.toLowerCase(),
    ...known.past,
    ...known.parliament,
    ...known.office,
    ...known.added.map((row) => row.address),
    ...known.forms,
  ];
  if (theirs.includes(address)) return { added: false, why: "exists" };
  await transaction(async (db) => {
    await query(
      `INSERT INTO politician_addresses (address, notable_person_id, source, added_by) VALUES ($1, $2, 'staff', $3)
       ON CONFLICT DO NOTHING`,
      [address, politicianId, by],
      db,
    );
    await query(
      "DELETE FROM politician_addresses WHERE address = $1 AND notable_person_id = $2 AND source = 'rejected'",
      [address, politicianId],
      db,
    );
    await logChange(by, "add politician address", { politicianId, address, note }, db);
  });
  await relinkOneOffs(Date.now());
  return { added: true };
}

/**
 * Removes an address staff added to a politician's, or one guessed to be
 * their office's, which is kept as rejected so that relinking doesn't guess
 * it again; logged, then relinks every thread, so those it alone linked to
 * them lose them. False if there was none.
 */
export async function removePoliticianAddress(politicianId: number, given: string, by: string): Promise<boolean> {
  const address = given.trim().toLowerCase();
  const removed = await transaction(async (db) => {
    const rows = await query<{ source: AddressSource }>(
      `DELETE FROM politician_addresses WHERE address = $1 AND notable_person_id = $2 AND source IN ('staff', 'office')
       RETURNING source`,
      [address, politicianId],
      db,
    );
    if (rows.some((row) => row.source === "office"))
      await query(
        `INSERT INTO politician_addresses (address, notable_person_id, source, added_by) VALUES ($1, $2, 'rejected', $3)
         ON CONFLICT DO NOTHING`,
        [address, politicianId, by],
        db,
      );
    if (rows.length) await logChange(by, "remove politician address", { politicianId, address }, db);
    return rows.length > 0;
  });
  if (removed) await relinkOneOffs(Date.now());
  return removed;
}
