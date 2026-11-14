// Staff Gmail accounts connected in a flow's database, as staff connect
// them on /staff/me, so the site can send from them and read them.
import { connectLettersInbox, databaseUrl } from "@/scripts/fresh-database.mjs";
import { fixtureEnv } from "@/lib/server/fixtures/fixture-env.mjs";
import { OUTBOX_DIR } from "../checkout.mjs";

/** Connects `email`'s Gmail, as someone logged in as it would on /staff/me, so the site can send from it. */
export function connectGmail(database: string, email: string) {
  connectLettersInbox(databaseUrl(database), email, fixtureEnv({ outboxDir: OUTBOX_DIR }).GMAIL_TOKEN_KEY);
}

/** Connects Joseph's and policy@'s Gmail, the fake mailboxes of lib/server/fixtures/policy-mailbox.ts. */
export function connectPolicyMailboxes(database: string) {
  for (const email of ["joseph@pauseai.uk", "policy@pauseai.uk"]) connectGmail(database, email);
}
