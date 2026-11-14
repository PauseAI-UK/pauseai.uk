// Postmark's webhooks, as they post to a fixture build, and the test MP
// whose address bounces.
import { expect, type APIRequestContext } from "@playwright/test";
import { TEST_MPS } from "@/lib/test-mps";
import { BASE } from "./fixtures";

/** Basic auth for the Postmark webhooks, as a fixture build is configured. */
export const WEBHOOK_AUTH = `Basic ${Buffer.from("postmark:fixture-webhook-password").toString("base64")}`;

/** Bouncy McTestface MP, whose address doesn't exist. */
export const bouncy = TEST_MPS.find((mp) => mp.postcode === "ZZ99ZH")!;

export const BOUNCY_ADDRESS = "no-such-mailbox@pauseai.uk";

/** Postmark's bounce webhook, as it posts one for a hard bounce of `messageId`, or of an email we can't place. */
export async function postBounce(request: APIRequestContext, messageId?: string) {
  const bounce = await request.post(`${BASE}/api/postmark/bounce`, {
    headers: { Authorization: WEBHOOK_AUTH },
    data: {
      RecordType: "Bounce",
      MessageID: messageId,
      Type: "HardBounce",
      TypeCode: 1,
      Name: "Hard bounce",
      Description: "The server was unable to deliver your message (ex: unknown user, mailbox not found).",
      Email: BOUNCY_ADDRESS,
      BouncedAt: "2026-10-16T12:00:00Z",
      Inactive: true,
      CanActivate: true,
    },
  });
  expect(await bounce.json()).toEqual({ recorded: true });
}
