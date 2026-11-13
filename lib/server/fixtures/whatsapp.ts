import { createHash } from "node:crypto";
import { GRAPH_VERSION } from "../outside-services/whatsapp";

// The fake WhatsApp Cloud API a fixture build and the tests talk to: the
// account's one number, sends it takes, and templates it takes for
// approval, all answered as Meta answers them. Approval, delivery and
// replies come by its webhook, which the storyboard posts itself
// (tests/whatsapp-webhooks.ts).

/** Meta's ID for our number in a fixture build, which sends go to. */
export const FIXTURE_PHONE_ID = "fixture-phone";

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}

/** An ID that depends only on what was sent, so the same send has the same ID every run. */
const idOf = (text: string): string => createHash("sha256").update(text).digest("hex").slice(0, 16);

/** The fake's answer to a call to the Graph API, if it's one it knows. */
export function whatsAppResponse(pathname: string, init?: RequestInit): Response | undefined {
  const path = pathname.replace(`/${GRAPH_VERSION}/`, "");
  const method = init?.method ?? "GET";
  if (path.endsWith("/phone_numbers")) {
    // Made up: a number Ofcom keeps for drama (https://www.ofcom.org.uk/phones-and-broadband/phone-numbers/numbers-for-drama).
    return json({
      data: [{ id: FIXTURE_PHONE_ID, display_phone_number: "+44 7700 900000", messaging_limit_tier: "TIER_250" }],
    });
  }
  if (path === `${FIXTURE_PHONE_ID}/messages` && method === "POST") {
    return json({ messaging_product: "whatsapp", messages: [{ id: `wamid.fixture-${idOf(String(init!.body))}` }] });
  }
  if (path.endsWith("/message_templates") && method === "POST") {
    const { name } = JSON.parse(String(init!.body)) as { name: string };
    return json({ id: `fixture-template-${idOf(name)}`, status: "PENDING", category: "MARKETING" });
  }
  if (path.endsWith("/message_templates") && method === "DELETE") return json({ success: true });
  if (path.endsWith("/message_templates")) return json({ data: [] });
  return undefined;
}
