import "server-only";
import { TOPICS, WAYS, type ContactPermission } from "./contact-permissions";
import { query } from "@/lib/server/db.server";

// What we may contact each address and number about, from the answers kept
// by the rules (contact_permissions_kept, which migration 0142 explains;
// lib/supporters/contact-permissions.ts).

/**
 * Every consent's answer for each of `emails`, then each of `phones` (in
 * international format), in their order, a topic at a time, each by
 * text before call.
 */
export async function permissionsFor(emails: string[], phones: string[] = []): Promise<ContactPermission[]> {
  const addresses = [...new Set(emails.map((address) => address.trim().toLowerCase()))];
  // Each address's place in its list comes from a join, not array_position(), which reads the list for every
  // answer: slow for a broadcast's thousands. Filtering by ANY() as well lets Postgres look each one up.
  return query<ContactPermission>(
    `SELECT p.topic, p.way, p.channel, p.address, p.send, p.reason, p.at, p.source
     FROM contact_permissions_kept p
     JOIN (SELECT 'email' AS channel, u.address, u.n FROM unnest($1::text[]) WITH ORDINALITY u (address, n)
       UNION ALL SELECT 'phone', u.address, u.n FROM unnest($2::text[]) WITH ORDINALITY u (address, n)) w
       ON w.channel = p.channel AND w.address = p.address
     WHERE (p.channel = 'email' AND p.address = ANY($1::text[])) OR (p.channel = 'phone' AND p.address = ANY($2::text[]))
     ORDER BY p.channel, w.n, array_position($3::text[], p.topic), array_position($4::text[], p.way)`,
    [addresses, [...new Set(phones)], TOPICS, WAYS],
  );
}
