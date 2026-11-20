import "server-only";
import { query } from "@/lib/server/db.server";
import { nameLine } from "@/lib/server/outside-services/postmark.server";

/**
 * A staff member's address as a To or Cc line, with the name their Gmail
 * sends as, the only name the site has for them; bare if they've none.
 */
export async function staffAddressLine(email: string): Promise<string> {
  const [row] = await query<{ name: string }>(
    "SELECT gmail_name AS name FROM staff_accounts WHERE email = $1 AND gmail_name <> ''",
    [email.toLowerCase()],
  );
  return row ? nameLine(row.name, email) : email;
}

/**
 * A staff member's first name, to sign an email with: the first word of the
 * name their Gmail sends as, or else their address's first part, capitalised
 * (francis@ is Francis).
 */
export async function staffFirstName(email: string): Promise<string> {
  const [row] = await query<{ name: string }>(
    "SELECT gmail_name AS name FROM staff_accounts WHERE email = $1 AND gmail_name <> ''",
    [email.toLowerCase()],
  );
  const name = row ? row.name.trim().split(/\s+/)[0] : email.split("@")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}
