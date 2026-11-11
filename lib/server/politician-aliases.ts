import "server-only";
import { keepsPoliticianThreads, nameParts, type PoliticianBook } from "@/lib/one-off";
import { auditActions, logChange } from "./audit";
import { config } from "./config";
import { query, transaction } from "./db";
import { gmailAccess } from "./gmail-accounts";
import { ONE_OFF_HEADERS, keepIfPoliticianThread } from "./one-off-emails";
import { relinkOneOffs } from "./one-off-relink";
import { gmailMessageHeaders, searchGmail, unlessGone } from "./outside-services/gmail";
import { connectedAccounts, readPoliticianBook } from "./politician-book";

// A politician's aliases: every address and domain that says a message is
// theirs, and where each came from, for the foot of their page; and the
// addresses staff add by hand, such as a personal Gmail.

/**
 * Where an address in politician_addresses came from: Parliament's list, the
 * threads their office is in, or staff; or an office's that staff rejected.
 */
export type AddressSource = "parliament" | "office" | "staff" | "rejected";

/** An address staff added: who and when. */
export type AddedAddress = { address: string; addedBy: string; at: Date };

/** Every address and domain that's a politician's, by where it came from. */
export type PoliticianAliases = {
  /** Their email, which letters go to. */
  email: string | null;
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
  const [past, listed, domains, book] = await Promise.all([
    query<{ address: string }>(
      `SELECT DISTINCT lower(jsonb_array_elements_text(details->'changed'->'email')) AS address
       FROM audit_log WHERE action = ${auditActions("edit politician")} AND (details->>'id')::bigint = $1
         AND details->'changed' ? 'email' ORDER BY address`,
      [politician.id],
    ),
    query<{ address: string; source: AddressSource; addedBy: string | null; at: Date }>(
      `SELECT address, source, added_by AS "addedBy", created_at AS at FROM politician_addresses
       WHERE notable_person_id = $1 ORDER BY address`,
      [politician.id],
    ),
    query<{ domain: string }>("SELECT domain FROM politician_domains WHERE notable_person_id = $1 ORDER BY domain", [
      politician.id,
    ]),
    readPoliticianBook(true),
  ]);
  const email = politician.email?.toLowerCase() ?? null;
  const from = (source: AddressSource) =>
    listed.filter((row) => row.source === source && row.address !== email).map((row) => row.address);
  return {
    email: politician.email,
    past: past.map((row) => row.address).filter((address) => address !== email && address.includes("@")),
    parliament: from("parliament"),
    office: from("office"),
    added: listed
      .filter((row) => row.source === "staff")
      .map(({ address, addedBy, at }) => ({ address, addedBy: addedBy!, at })),
    domains: domains.map((row) => row.domain),
    // Only forms not already listed as one of theirs.
    forms: formExamples(book, politician).filter(
      (form) => form !== email && !listed.some((row) => row.address === form && row.source !== "rejected"),
    ),
  };
}

/** How many messages the search for a new address keeps from each mailbox, at most, so that adding one ends inside a request. */
const SEARCH_AT_MOST = 50;

/**
 * Keeps what the mailboxes we keep hold with an address in it, anywhere:
 * the messages the regular read passed over before the address was known.
 * Gives how many it kept that weren't kept already.
 */
async function searchMailboxes(address: string): Promise<number> {
  const count = async () => (await query<{ n: number }>("SELECT count(*)::int AS n FROM one_off_messages"))[0].n;
  const before = await count();
  for (const account of (await connectedAccounts()).filter(keepsPoliticianThreads)) {
    const token = await gmailAccess(account);
    const found = await searchGmail(token, `"${address}"`, SEARCH_AT_MOST);
    const kept = await query<{ id: string }>(
      "SELECT gmail_message_id AS id FROM one_off_messages WHERE account = $1 AND gmail_message_id = ANY($2::text[])",
      [account, found],
    );
    for (const id of found.filter((id) => !kept.some((row) => row.id === id))) {
      const message = await gmailMessageHeaders(token, id, ONE_OFF_HEADERS).catch(unlessGone);
      if (message) await keepIfPoliticianThread(account, token, message, account === config.policyInbox);
    }
  }
  return (await count()) - before;
}

/** What adding an address did: kept, with how many messages the search kept; or why not. */
export type AddResult = { added: true; kept: number } | { added: false; why: "invalid" | "exists" };

/**
 * Adds an address to a politician's by hand, logged, then keeps the mail
 * with it that the mailboxes hold and relinks every thread, so that it shows
 * on their page. Gives what happened.
 */
export async function addPoliticianAddress(politicianId: number, given: string, by: string): Promise<AddResult> {
  const address = given.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { added: false, why: "invalid" };
  const added = await transaction(async (db) => {
    const rows = await query(
      `INSERT INTO politician_addresses (address, notable_person_id, source, added_by)
       SELECT $1, $2, 'staff', $3 WHERE EXISTS (SELECT 1 FROM politicians WHERE id = $2) ON CONFLICT DO NOTHING RETURNING 1`,
      [address, politicianId, by],
      db,
    );
    if (rows.length) {
      await query(
        "DELETE FROM politician_addresses WHERE address = $1 AND notable_person_id = $2 AND source = 'rejected'",
        [address, politicianId],
        db,
      );
      await logChange(by, "add politician address", { politicianId, address }, db);
    }
    return rows.length > 0;
  });
  if (!added) return { added: false, why: "exists" };
  const kept = await searchMailboxes(address);
  await relinkOneOffs(Date.now());
  return { added: true, kept };
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
