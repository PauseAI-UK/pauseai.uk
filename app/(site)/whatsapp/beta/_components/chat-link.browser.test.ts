import { afterEach, describe, expect, it, vi } from "vitest";
import { askChatLink } from "./chat-link";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("askChatLink", () => {
  it("posts the token and utm_source to the waiting room's endpoint and gives back its answer", async () => {
    const fetch = vi.spyOn(window, "fetch").mockResolvedValue(Response.json({ ok: false, reason: "closed" }));
    expect(await askChatLink("t", "parents")).toEqual({ ok: false, reason: "closed" });
    expect(fetch).toHaveBeenCalledWith("/api/whatsapp/waiting-room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"turnstileToken":"t","utmSource":"parents"}',
    });
  });
});
