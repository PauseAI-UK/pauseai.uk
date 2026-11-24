import "server-only";
import { GMAIL_DAILY_LIMIT } from "./gmail-connect";
import { query } from "@/lib/server/db.server";

// Staff members' Gmail, connected so mailings to politicians can be sent
// from it and replies read from it. Each staff member connects their own,
// from their page or from a mailing's Sent from; once it's connected, any
// staff member can send a mailing from it. The refresh token is kept
// encrypted on their account (staff_accounts), and deleted when they
// disconnect or their account is removed. This file reads which are
// connected; ./gmail-access.server.ts connects them and gets their tokens.

export { GMAIL_DAILY_LIMIT };

/**
 * A connected Gmail: its address; the name it sends as, empty when it has
 * none of its own; and how many it has sent in the last day and how many
 * more it can.
 */
export type GmailAccount = { email: string; name: string; connectedAt: Date; sentToday: number; remaining: number };

const SENT_TODAY = `(SELECT count(*)::int FROM email_sends s
  WHERE s.sender = a.email AND s.outcome = 'sent' AND s.at > now() - interval '1 day')`;

/** Every connected account, by address. */
export async function gmailAccounts(): Promise<GmailAccount[]> {
  const rows = await query<{ email: string; name: string; connectedAt: Date; sentToday: number }>(
    `SELECT a.email, coalesce(a.gmail_name, '') AS name, a.gmail_connected_at AS "connectedAt", ${SENT_TODAY} AS "sentToday"
     FROM staff_accounts a WHERE a.gmail_token IS NOT NULL ORDER BY a.email`,
  );
  return rows.map((row) => ({ ...row, remaining: Math.max(0, GMAIL_DAILY_LIMIT - row.sentToday) }));
}

/** One account's Gmail, if it's connected. */
export async function gmailAccount(email: string): Promise<GmailAccount | undefined> {
  return (await gmailAccounts()).find((account) => account.email === email.toLowerCase());
}

/** How many `email` has sent in the last day, connected or not. */
export async function sentToday(email: string): Promise<number> {
  const [row] = await query<{ sent: number }>(`SELECT ${SENT_TODAY} AS sent FROM (SELECT $1::text AS email) a`, [
    email.toLowerCase(),
  ]);
  return row.sent;
}

/** The connected accounts and where reading each last got to. */
export async function gmailReadingState(): Promise<{ email: string; historyId: string }[]> {
  return query<{ email: string; historyId: string }>(
    `SELECT email, gmail_history_id AS "historyId"
     FROM staff_accounts WHERE gmail_token IS NOT NULL ORDER BY email`,
  );
}
