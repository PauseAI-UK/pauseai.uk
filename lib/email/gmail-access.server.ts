import "server-only";
import { logChange } from "@/lib/server/audit.server";
import { query } from "@/lib/server/db.server";
import { config } from "@/lib/server/config.server";
import { notifyStaff, staffLink } from "./notifications.server";
import { decryptToken, encryptToken } from "./gmail-tokens.server";
import { orFallback } from "@/lib/server/outside-services/fallback.server";
import {
  exchangeGmailCode,
  gmailAccessToken,
  gmailProfile,
  gmailSendName,
  GmailError,
  revokeGmail,
} from "@/lib/server/outside-services/gmail.server";
import { emailCopy, emailProblems } from "./copy";
import { staffAccount } from "@/lib/problems";

// Connecting a staff member's Gmail (./gmail-accounts.server.ts), and
// using it: an access token from its refresh token, and where reading it
// got to. A Gmail whose access Google has revoked is disconnected, and
// staff told.

/** Why connecting didn't: the person consented as another Google account than their own. */
export type ConnectResult = { connected: true } | { connected: false; reason: "other-account" };

/**
 * Connects `account`'s Gmail with the code Google's consent came back with,
 * if the mailbox consented to is the account's own, and starts reading it
 * from now. Logs it.
 */
export async function connectGmail(account: string, code: string, redirectUri: string): Promise<ConnectResult> {
  const refreshToken = await exchangeGmailCode(code, redirectUri);
  const { token } = await gmailAccessToken(refreshToken);
  const profile = await gmailProfile(token);
  if (profile.emailAddress.toLowerCase() !== account.toLowerCase()) {
    await revokeGmail(refreshToken);
    return { connected: false, reason: "other-account" };
  }
  await query(
    `UPDATE staff_accounts SET gmail_token = $2, gmail_connected_at = now(), gmail_history_id = $3, gmail_name = $4
     WHERE email = $1`,
    [account.toLowerCase(), encryptToken(refreshToken), profile.historyId, await gmailSendName(token)],
  );
  await logChange(account, "connect gmail", { email: account.toLowerCase() });
  return { connected: true };
}

/** Forgets `account`'s token, as `by`, and logs it. Says whether it was connected. */
async function forget(account: string, by: string, why: string): Promise<string | undefined> {
  const [row] = await query<{ token: Buffer }>(
    `WITH old AS (SELECT email, gmail_token FROM staff_accounts WHERE email = $1 AND gmail_token IS NOT NULL FOR UPDATE)
     UPDATE staff_accounts a SET gmail_token = NULL, gmail_connected_at = NULL, gmail_history_id = NULL, gmail_name = NULL
     FROM old WHERE a.email = old.email RETURNING old.gmail_token AS token`,
    [account.toLowerCase()],
  );
  if (!row) return undefined;
  await logChange(by, "disconnect gmail", { email: account.toLowerCase(), why });
  return decryptToken(row.token);
}

/** Disconnects `account`'s Gmail, as `by`: tells Google, then deletes the token. Says whether it was connected. */
export async function disconnectGmail(account: string, by: string): Promise<boolean> {
  const token = await forget(account, by, "disconnected");
  if (token === undefined) return false;
  await orFallback(emailProblems.tokenNotRevoked({ account: staffAccount(account) }), undefined, () =>
    revokeGmail(token),
  );
  return true;
}

/**
 * Access tokens, until a minute before they expire, by the stored refresh
 * token they came from, so connecting again starts afresh.
 */
const accessTokens = new Map<string, { token: string; until: number }>();

/**
 * An access token for a connected account. If Google no longer accepts its
 * refresh token, as when the person removed the site's access, the account
 * is disconnected, and logged so. Throws a GmailError for an account that
 * isn't connected, or that Google refused.
 */
export async function gmailAccess(account: string): Promise<string> {
  const email = account.toLowerCase();
  const [row] = await query<{ token: Buffer | null }>(
    "SELECT gmail_token AS token FROM staff_accounts WHERE email = $1",
    [email],
  );
  if (!row?.token) throw new GmailError(`${email}'s Gmail isn't connected`, 0);
  const key = row.token.toString("base64");
  const cached = accessTokens.get(key);
  if (cached && cached.until > Date.now()) return cached.token;
  try {
    const { token, expiresIn } = await gmailAccessToken(decryptToken(row.token));
    accessTokens.set(key, { token, until: Date.now() + (expiresIn - 60) * 1000 });
    return token;
  } catch (error) {
    if (error instanceof GmailError && error.revoked) await forgetRevoked(email);
    throw error;
  }
}

/** Where an account connects its Gmail: its own page. */
const ACCOUNT_PATH = "/staff/me";

/**
 * Forgets `email`'s Gmail, as Google no longer lets us use it, and, the
 * first time, emails the notification inbox: someone has to log in as it
 * and connect it again.
 */
async function forgetRevoked(email: string): Promise<void> {
  if ((await forget(email, "google", "access revoked")) === undefined) return;
  const words = emailCopy.notifications.gmailDisconnected;
  await notifyStaff(
    words.subject(email),
    words.body(email, email === config.lettersInbox, staffLink(ACCOUNT_PATH, undefined)),
  );
}

/** Keeps the name `email`'s connected Gmail now sends as, as reading it finds it. */
export async function saveGmailName(email: string, name: string): Promise<void> {
  await query("UPDATE staff_accounts SET gmail_name = $2 WHERE email = $1 AND gmail_token IS NOT NULL", [
    email.toLowerCase(),
    name,
  ]);
}

/** Where reading an account got to. */
export async function saveHistoryId(account: string, historyId: string): Promise<void> {
  await query("UPDATE staff_accounts SET gmail_history_id = $2 WHERE email = $1 AND gmail_token IS NOT NULL", [
    account,
    historyId,
  ]);
}
