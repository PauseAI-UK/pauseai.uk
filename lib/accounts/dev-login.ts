import "server-only";
import { config } from "@/lib/server/config";
import { listStaffAccounts } from "./staff-accounts";
import { accountsCopy } from "./copy";

/** A pauseai.uk address with no account yet, to see someone's first login. */
export const NOBODY = "nobody@pauseai.uk";

/** One address the dev login offers, and what it is: its permissions, an account with none, or no account yet. */
export type DevLoginChoice = { email: string; description: string };

/**
 * The shared inboxes a person may log in as, to see the site as they do:
 * the letters inbox (LETTERS_INBOX) and the policy team's (POLICY_INBOX),
 * where they're at pauseai.uk, as only those can log in; each with what it is.
 */
function sharedInboxes(): { email: string; role: string }[] {
  const copy = accountsCopy.devLogin;
  return [
    { email: config.lettersInbox, role: copy.lettersInbox },
    { email: config.policyInbox, role: copy.policyInbox },
  ].flatMap(({ email, role }) => (email && /@pauseai\.uk$/.test(email) ? [{ email, role }] : []));
}

/**
 * The addresses the dev login offers, in a fixture build: every account,
 * the shared inboxes saying which they are, then, until each has one, the
 * shared inboxes and an address with no account yet. Undefined anywhere
 * else, where there's no dev login.
 */
export async function devLoginAccounts(): Promise<DevLoginChoice[] | undefined> {
  if (!config.fixtures) return undefined;
  const copy = accountsCopy.devLogin;
  const shared = sharedInboxes();
  const roleOf = (email: string) => shared.find((inbox) => inbox.email === email)?.role;
  const accounts = (await listStaffAccounts()).map((account) => {
    const description =
      account.permissions.length > 0
        ? copy.permissions(account.permissions.map((p) => accountsCopy.accounts.names[p]).join(", "))
        : copy.noPermissions;
    const role = roleOf(account.email);
    return { email: account.email, description: role ? `${role} · ${description}` : description };
  });
  const missing = [
    ...shared.map(({ email, role }) => ({ email, description: `${role} · ${copy.noAccount}` })),
    { email: NOBODY, description: copy.noAccount },
  ].filter((choice) => !accounts.some((account) => account.email === choice.email));
  return [...accounts, ...missing];
}
