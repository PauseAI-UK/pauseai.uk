import "server-only";
import { query } from "@/lib/server/db.server";
import { nameLine } from "@/lib/server/proxies.server";

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
