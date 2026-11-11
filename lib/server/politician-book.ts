import "server-only";
import { cache } from "react";
import type { PoliticianBook } from "@/lib/one-off";
import { auditActions } from "./audit";
import { query } from "./db";
import { gmailAccounts } from "./gmail-accounts";

// Every address a politician has or has had, and the domains of their own:
// what says a message is to or from one, and whose thread it is.

/**
 * The politician book: current addresses, past ones from the audit log's
 * edits, and their own domains. Read once a page, however many of its
 * loaders ask (React's cache()).
 */
export const politicianBook = cache(async function politicianBook(): Promise<PoliticianBook> {
  const [rows, owned] = await Promise.all([
    query<{ id: number; address: string }>(
      `SELECT id, address FROM (
       SELECT id::int AS id, lower(email) AS address FROM notable_people
       UNION
       SELECT (details->>'id')::int, lower(jsonb_array_elements_text(details->'changed'->'email'))
         FROM audit_log WHERE action = ${auditActions("edit politician")} AND details->'changed' ? 'email'
     ) every WHERE address LIKE '%@%'`,
    ),
    query<{ domain: string; id: number }>(`SELECT domain, notable_person_id::int AS id FROM politician_domains`),
  ]);
  const addresses = new Map<string, number[]>();
  for (const { id, address } of rows) {
    addresses.set(address, [...(addresses.get(address) ?? []), id]);
  }
  return { addresses, domains: new Map(owned.map(({ domain, id }) => [domain, id])) };
});

/** The connected Gmails, which with the aliases are PauseAI's accounts. */
export async function connectedAccounts(): Promise<string[]> {
  return (await gmailAccounts()).map((account) => account.email);
}
