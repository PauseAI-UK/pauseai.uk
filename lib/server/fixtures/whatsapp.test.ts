import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { FIXTURE_PHONE_ID, whatsAppResponse } from "./whatsapp";

const at = (path: string) => `/v23.0/${path}`;
const json = async (response: Response | undefined) => (await response!.json()) as Record<string, unknown>;

let outbox: string;
beforeEach(() => {
  outbox = mkdtempSync(join(tmpdir(), "whatsapp-outbox-"));
  vi.stubEnv("OUTBOX_DIR", outbox);
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(outbox, { recursive: true, force: true });
});

/** The words of each file in the outbox, oldest first. */
const written = () =>
  readdirSync(outbox)
    .sort()
    .map((file) => readFileSync(join(outbox, file), "utf8"));

/** A template sent to `to`, with Jane's first name, as sendTemplate sends it. */
const templateSend = (to: string) =>
  JSON.stringify({
    to,
    type: "template",
    template: {
      name: "march_day_1",
      components: [{ type: "body", parameters: [{ type: "text", parameter_name: "first_name", text: "Jane" }] }],
    },
  });

it("gives our one number, at the lowest tier", async () => {
  expect(await json(whatsAppResponse(at("fixture-account/phone_numbers")))).toEqual({
    data: [{ id: FIXTURE_PHONE_ID, display_phone_number: "+44 7700 900000", messaging_limit_tier: "TIER_250" }],
  });
});

it("takes each send, the same send with the same ID every time", async () => {
  const send = (to: string) =>
    whatsAppResponse(at(`${FIXTURE_PHONE_ID}/messages`), { method: "POST", body: templateSend(to) });
  const first = await json(send("447700900001"));
  expect(first).toMatchObject({ messages: [{ id: expect.stringMatching(/^wamid\.fixture-\w{16}$/) }] });
  expect(await json(send("447700900001"))).toEqual(first);
  expect(await json(send("447700900002"))).not.toEqual(first);
  // A send from a number that isn't ours, or not a send, isn't known.
  expect(whatsAppResponse(at("other/messages"), { method: "POST", body: "{}" })).toBeUndefined();
  expect(whatsAppResponse(at(`${FIXTURE_PHONE_ID}/messages`))).toBeUndefined();
});

it("writes each text to the outbox: a template with its fields, or words of our own", () => {
  whatsAppResponse(at(`${FIXTURE_PHONE_ID}/messages`), { method: "POST", body: templateSend("447700900001") });
  whatsAppResponse(at(`${FIXTURE_PHONE_ID}/messages`), {
    method: "POST",
    body: JSON.stringify({ to: "447700900001", type: "text", text: { body: "Thanks, see you there" } }),
  });
  expect(readdirSync(outbox).every((file) => file.endsWith(".txt"))).toBe(true);
  expect(written()).toEqual([
    "WhatsApp text from +44 7700 900000 to +447700900001\nTemplate: march_day_1\n  first_name: Jane\n",
    "WhatsApp text from +44 7700 900000 to +447700900001\n\nThanks, see you there\n",
  ]);
});

it("writes to tmp/outbox in the dev server, and nowhere in the tests without an outbox", () => {
  vi.stubEnv("OUTBOX_DIR", "");
  whatsAppResponse(at(`${FIXTURE_PHONE_ID}/messages`), { method: "POST", body: templateSend("447700900001") });
  expect(console.info).not.toHaveBeenCalled();
  vi.stubEnv("NODE_ENV", "development");
  const cwd = process.cwd();
  process.chdir(outbox);
  try {
    whatsAppResponse(at(`${FIXTURE_PHONE_ID}/messages`), { method: "POST", body: templateSend("447700900001") });
  } finally {
    process.chdir(cwd);
  }
  expect(readdirSync(join(outbox, "tmp/outbox"))).toHaveLength(1);
});

it("takes templates for approval, writing each to the outbox, deletes them, and lists none", async () => {
  const made = await json(
    whatsAppResponse(at("fixture-account/message_templates"), {
      method: "POST",
      body: JSON.stringify({
        name: "march_day_1",
        components: [
          { type: "BODY", text: "Hi {{first_name}}, the march is on Saturday." },
          { type: "FOOTER", text: "Reply STOP to stop event texts" },
        ],
      }),
    }),
  );
  expect(made).toMatchObject({
    id: expect.stringMatching(/^fixture-template-/),
    status: "PENDING",
    category: "MARKETING",
  });
  expect(written()).toEqual([
    "WhatsApp template sent for approval: march_day_1\n\nHi {{first_name}}, the march is on Saturday.\n\nReply STOP to stop event texts\n",
  ]);
  expect(await json(whatsAppResponse(at("fixture-account/message_templates"), { method: "DELETE" }))).toEqual({
    success: true,
  });
  expect(await json(whatsAppResponse(at("fixture-account/message_templates")))).toEqual({ data: [] });
});

it("knows nothing else", () => {
  expect(whatsAppResponse(at("fixture-account/subscribed_apps"))).toBeUndefined();
});
