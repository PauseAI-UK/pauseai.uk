import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/tests/fixtures/msw";
import { checkReply } from "./waiting-room-check.server";
import { waitingRoomProblems } from "./waiting-room-copy";

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "key");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/** Claude answering every check with `answer`, and what it was asked. */
function claudeSays(answer: object) {
  const asked: { system: string; messages: { content: string }[] }[] = [];
  server.use(
    http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
      asked.push((await request.json()) as (typeof asked)[number]);
      return HttpResponse.json({
        stop_reason: "end_turn",
        content: [{ type: "text", text: JSON.stringify(answer) }],
      });
    }),
  );
  return asked;
}

describe("the waiting room's check", () => {
  it("asks Claude of their reply, with our welcome, and keeps a postcode in capitals and an email, trimmed", async () => {
    const asked = claudeSays({
      verdict: "pass",
      reason: "Sincere.",
      postcode: " ls6 1aa ",
      email: " jane@example.com ",
    });
    expect(await checkReply("Worried, LS6 1AA")).toEqual({
      verdict: "pass",
      reason: "Sincere.",
      postcode: "LS6 1AA",
      email: "jane@example.com",
    });
    expect(asked[0].system).toContain("Thanks for asking to join");
    expect(asked[0].messages[0].content).toBe("Their reply:\n<reply>\nWorried, LS6 1AA\n</reply>");
  });

  it("takes a blank postcode or email as none", async () => {
    claudeSays({ verdict: "hold", reason: "Empty.", postcode: " ", email: null });
    expect(await checkReply("hi")).toEqual({ verdict: "hold", reason: "Empty.", postcode: null, email: null });
  });

  it("gives none, and says so, when Claude can't be asked", async () => {
    server.use(http.post("https://api.anthropic.com/v1/messages", () => HttpResponse.json({}, { status: 500 })));
    expect(await checkReply("hi")).toBeNull();
    expect(console.error).toHaveBeenCalledWith(waitingRoomProblems.checkFailed().what, expect.any(String));
  });
});
