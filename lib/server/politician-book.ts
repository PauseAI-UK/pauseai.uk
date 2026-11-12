import "server-only";
import { cache } from "react";
import { addressForms, type FormPerson, type PoliticianBook } from "@/lib/one-off";
import { auditActions } from "./audit";
import { query } from "./db";
import { gmailAccounts } from "./gmail-accounts";

// Every address a politician has or has had, the domains of their own, and
// the forms of parliament address their name and seat make: what says a
// message is to or from one, and whose thread it is.

/**
 * SQL for the book's addresses, a row for each with whose it is (`id`,
 * `address`): current addresses, past ones from the audit log's edits, those
 * Parliament lists, staff added, and, where `offices` (SQL) is true, their
 * offices' (politician_addresses, but for those staff rejected).
 */
export const bookAddresses = (offices: string) => `SELECT id, address FROM (
    SELECT id::int AS id, lower(email) AS address FROM notable_people
    UNION
    SELECT (details->>'id')::int, lower(jsonb_array_elements_text(details->'changed'->'email'))
      FROM audit_log WHERE action = ${auditActions("edit politician")} AND details->'changed' ? 'email'
    UNION
    SELECT notable_person_id::int, address FROM politician_addresses
      WHERE source <> 'rejected' AND (${offices} OR source <> 'office')
  ) every WHERE address LIKE '%@%'`;

/**
 * The book, read now: its addresses (bookAddresses), with their offices'
 * only with `offices`; their own domains; and their address forms.
 */
export async function readPoliticianBook(offices: boolean): Promise<PoliticianBook> {
  const [rows, owned, people] = await Promise.all([
    query<{ id: number; address: string }>(bookAddresses("$1"), [offices]),
    query<{ domain: string; id: number }>(`SELECT domain, notable_person_id::int AS id FROM politician_domains`),
    query<FormPerson>(
      `SELECT n.id::int AS id, n.name, p.house, p.constituency, n.status = 'in_office' AS "inOffice"
       FROM notable_people n JOIN politicians p USING (id)`,
    ),
  ]);
  const addresses = new Map<string, number[]>();
  for (const { id, address } of rows) {
    addresses.set(address, [...(addresses.get(address) ?? []), id]);
  }
  return {
    addresses,
    domains: new Map(owned.map(({ domain, id }) => [domain, id])),
    forms: addressForms(people),
  };
}

/** The politician book, offices' addresses and all: read once a page, however many of its loaders ask (React's cache()). */
export const politicianBook = cache(async function politicianBook(): Promise<PoliticianBook> {
  return readPoliticianBook(true);
});

/** The connected Gmails, which with the aliases are PauseAI's accounts. */
export async function connectedAccounts(): Promise<string[]> {
  return (await gmailAccounts()).map((account) => account.email);
}
