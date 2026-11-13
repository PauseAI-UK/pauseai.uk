import { expect, it } from "vitest";
import { FIXTURE_PHONE_ID, whatsAppResponse } from "./whatsapp";

const at = (path: string) => `/v23.0/${path}`;
const json = async (response: Response | undefined) => (await response!.json()) as Record<string, unknown>;

it("gives our one number, at the lowest tier", async () => {
  expect(await json(whatsAppResponse(at("fixture-account/phone_numbers")))).toEqual({
    data: [{ id: FIXTURE_PHONE_ID, display_phone_number: "+44 7700 900000", messaging_limit_tier: "TIER_250" }],
  });
});

it("takes each send, the same send with the same ID every time", async () => {
  const send = (to: string) =>
    whatsAppResponse(at(`${FIXTURE_PHONE_ID}/messages`), { method: "POST", body: JSON.stringify({ to }) });
  const first = await json(send("447700900001"));
  expect(first).toMatchObject({ messages: [{ id: expect.stringMatching(/^wamid\.fixture-\w{16}$/) }] });
  expect(await json(send("447700900001"))).toEqual(first);
  expect(await json(send("447700900002"))).not.toEqual(first);
  // A send from a number that isn't ours, or not a send, isn't known.
  expect(whatsAppResponse(at("other/messages"), { method: "POST", body: "{}" })).toBeUndefined();
  expect(whatsAppResponse(at(`${FIXTURE_PHONE_ID}/messages`))).toBeUndefined();
});

it("takes templates for approval, deletes them, and lists none", async () => {
  const made = await json(
    whatsAppResponse(at("fixture-account/message_templates"), {
      method: "POST",
      body: JSON.stringify({ name: "march_day_1" }),
    }),
  );
  expect(made).toMatchObject({
    id: expect.stringMatching(/^fixture-template-/),
    status: "PENDING",
    category: "MARKETING",
  });
  expect(await json(whatsAppResponse(at("fixture-account/message_templates"), { method: "DELETE" }))).toEqual({
    success: true,
  });
  expect(await json(whatsAppResponse(at("fixture-account/message_templates")))).toEqual({ data: [] });
});

it("knows nothing else", () => {
  expect(whatsAppResponse(at("fixture-account/subscribed_apps"))).toBeUndefined();
});
