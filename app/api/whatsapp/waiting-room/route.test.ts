import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitingRoomJoinCopy } from "@/lib/content/whatsapp";
import { chatLink, joinMessage } from "@/lib/broadcasts/waiting-room";
import { POST } from "./route";

/** Posts a body, JSON unless it's a string already, and reads the answer. */
async function ask(body: unknown) {
  const sent = typeof body === "string" ? body : JSON.stringify(body);
  const res = await POST(new Request("http://localhost/api/whatsapp/waiting-room", { method: "POST", body: sent }));
  expect(res.status).toBe(200);
  return res.json();
}

beforeEach(() => {
  vi.stubEnv("TURNSTILE_SECRET_KEY", "0xreal");
  vi.stubEnv("WHATSAPP_TOKEN", "token");
  vi.stubEnv("WHATSAPP_ACCOUNT_ID", "fixture-account");
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/whatsapp/waiting-room", () => {
  it("answers past the spam check with a link to a chat with our number, asking to join from the button's page", async () => {
    expect(await ask({ turnstileToken: "t", utmSource: "Parents" })).toEqual({
      ok: true,
      link: chatLink("+44 7700 900000", joinMessage(waitingRoomJoinCopy.message, "parents")),
    });
  });

  it("refuses without the spam check, and with a body that isn't JSON", async () => {
    expect(await ask({ utmSource: "parents" })).toEqual({ ok: false, reason: "spam-wait" });
    expect(await ask("not json")).toEqual({ ok: false, reason: "spam-wait" });
  });

  it("says it's closed while our number can't be had", async () => {
    vi.stubEnv("WHATSAPP_TOKEN", "");
    expect(await ask({ turnstileToken: "t" })).toEqual({ ok: false, reason: "closed" });
  });
});
