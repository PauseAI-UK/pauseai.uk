import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { staffCopy } from "@/lib/content/staff-interface";
import { query } from "@/lib/server/db.server";
import { verifyToken } from "@/lib/server/whatsapp-verify-token.mjs";
import { describeWithDatabase, useTestDatabase, withDatabaseDown } from "@/tests/database";
import { GET, POST } from "./route";

const SECRET = "test-app-secret";
const URL = "https://pauseai.uk/api/whatsapp";

beforeEach(() => vi.stubEnv("WHATSAPP_APP_SECRET", SECRET));
afterEach(() => vi.unstubAllEnvs());

/** Meta checking the callback URL, with these parameters. */
const check = (params: Record<string, string>) => GET(new NextRequest(`${URL}?${new URLSearchParams(params)}`));

it("answers Meta's check of the callback URL with its challenge, given our verify token", async () => {
  const ours = { "hub.mode": "subscribe", "hub.verify_token": verifyToken(SECRET), "hub.challenge": "1158201444" };
  const res = await check(ours);
  expect(res.status).toBe(200);
  expect(await res.text()).toBe("1158201444");
  expect(await (await check({ "hub.mode": "subscribe", "hub.verify_token": verifyToken(SECRET) })).text()).toBe("");
  expect((await check({ ...ours, "hub.verify_token": "guess" })).status).toBe(403);
  expect((await check({ ...ours, "hub.mode": "unsubscribe" })).status).toBe(403);
  vi.stubEnv("WHATSAPP_APP_SECRET", "");
  expect((await check(ours)).status).toBe(403);
});

/** A webhook as Meta posts it: signed over the body with the app's secret, unless `signature` says otherwise. */
function post(payload: unknown, signature?: string | null) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  const signed = `sha256=${createHmac("sha256", SECRET).update(body).digest("hex")}`;
  const headers: Record<string, string> = {};
  if (signature !== null) headers["X-Hub-Signature-256"] = signature ?? signed;
  return POST(new Request(URL, { method: "POST", headers, body }));
}

/** A user's setting turned off for marketing messages. */
const stopped = {
  entry: [
    {
      changes: [
        {
          field: "user_preferences",
          value: {
            user_preferences: [
              { wa_id: "447700900123", category: "marketing_messages", value: "stop", timestamp: 1793613600 },
            ],
          },
        },
      ],
    },
  ],
};

it("turns away a webhook not signed with the app's secret, or with none set", async () => {
  expect((await post(stopped, null)).status).toBe(401);
  expect((await post(stopped, "sha256=00")).status).toBe(401);
  vi.stubEnv("WHATSAPP_APP_SECRET", "");
  expect((await post(stopped)).status).toBe(401);
});

it("refuses a signed body that isn't JSON", async () => {
  expect((await post("not json")).status).toBe(400);
});

describeWithDatabase("POST /api/whatsapp", () => {
  useTestDatabase();

  it("applies what a webhook carries, saying how much in the answer and the log", async () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    const res = await post(stopped);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ applied: 1 });
    expect(console.info).toHaveBeenLastCalledWith("WhatsApp webhook: 1 applied");
    // One stop of every text.
    expect(await query("SELECT list FROM opt_outs WHERE source = 'whatsapp'")).toEqual([{ list: "all" }]);
  });

  it("answers 500, reporting it, when it can't be recorded, so Meta sends it again", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await withDatabaseDown(() => post(stopped));
    expect(res.status).toBe(500);
    expect(console.error).toHaveBeenCalledWith(staffCopy.problems.logs.whatsAppWebhookNotRecorded, expect.anything());
  });
});
