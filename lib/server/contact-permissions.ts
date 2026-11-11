import "server-only";
import { TOPICS, WAYS, type ContactPermission } from "@/lib/contact-permissions";
import { query } from "./db";

// What we may contact each address and number about, from the
// contact_permissions view, which holds the rules
// (lib/contact-permissions.ts).

/**
 * Every consent's answer for each of `emails`, then each of `phones` (as
 * phone_number() writes them), in their order, a topic at a time, each by
 * text before call.
 */
export async function permissionsFor(emails: string[], phones: string[] = []): Promise<ContactPermission[]> {
  const addresses = emails.map((address) => address.trim().toLowerCase());
  return query<ContactPermission>(
    `SELECT p.topic, p.way, p.channel, p.address, p.send, p.reason, p.at, p.source
     FROM contact_permissions p
     WHERE (p.channel = 'email' AND p.address = ANY($1::text[])) OR (p.channel = 'phone' AND p.address = ANY($2::text[]))
     ORDER BY p.channel, array_position(CASE WHEN p.channel = 'email' THEN $1::text[] ELSE $2::text[] END, p.address),
       array_position($3::text[], p.topic), array_position($4::text[], p.way)`,
    [addresses, phones, TOPICS, WAYS],
  );
}
