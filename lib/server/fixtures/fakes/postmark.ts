import { json, type Fake } from "../fake";
import { fixtureUuid } from "../fixture-uuid";

// Postmark's API: sending, and taking an address off a stream's suppressions.

export const postmarkFake: Fake = ({ hostname, pathname }, init) => {
  // Postmark accepts every email. What was sent is checked from the request
  // (Vitest) or the outbox (Playwright, lib/server/fixtures/outbox.ts). The
  // MessageID is made from the email, so the same letter gets the same id
  // every run: it shows on the staff letters page, which the storyboard
  // compares. Each letter's address ends in random digits, so they're left out.
  if (hostname === "api.postmarkapp.com" && pathname === "/email") {
    return json({
      To: "",
      SubmittedAt: new Date().toISOString(),
      MessageID: fixtureUuid(String(init?.body ?? "").replace(/\.\d{6}@/g, "@")),
      ErrorCode: 0,
      Message: "OK",
    });
  }
  const unsuppress =
    hostname === "api.postmarkapp.com" && pathname.match(/^\/message-streams\/[\w-]+\/suppressions\/delete$/);
  if (unsuppress) {
    const { Suppressions } = JSON.parse(String(init!.body)) as { Suppressions: { EmailAddress: string }[] };
    return json({
      Suppressions: Suppressions.map(({ EmailAddress }) => ({ EmailAddress, Status: "Deleted", Message: null })),
    });
  }
  return undefined;
};
