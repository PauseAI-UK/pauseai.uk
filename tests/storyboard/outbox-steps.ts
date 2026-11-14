// The emails the build under test has sent, from its outbox
// (lib/server/fixtures/outbox.ts). A flow pictures one with emailFrame
// (./email-frame.ts).
import { OUTBOX_DIR } from "../checkout.mjs";
import { type OutboxEmail, readOutbox } from "@/lib/server/fixtures/outbox";

/** The newest email the build under test has sent that `matches`. */
export function newestEmail(matches: (email: OutboxEmail) => boolean): OutboxEmail | undefined {
  return readOutbox(OUTBOX_DIR).filter(matches).at(-1);
}

/** The newest email sent to `to`, an address, with a name or without. */
export function newestEmailTo(to: string): OutboxEmail | undefined {
  return newestEmail((email) => email.To === to || email.To.endsWith(`<${to}>`));
}
