import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deliveryProblem, isPostmark } from "./postmark-webhooks.server";

const basic = (credentials: string) => `Basic ${Buffer.from(credentials).toString("base64")}`;
const withAuth = (authorization?: string) =>
  new Request("https://pauseai.uk/api/postmark/bounce", { headers: authorization ? { authorization } : {} });

beforeEach(() => {
  vi.stubEnv("POSTMARK_WEBHOOK_USER", "postmark");
  vi.stubEnv("POSTMARK_WEBHOOK_PASSWORD", "hunter2");
});
afterEach(() => vi.unstubAllEnvs());

describe("isPostmark", () => {
  it("accepts only our username and password", () => {
    expect(isPostmark(withAuth(basic("postmark:hunter2")))).toBe(true);
    expect(isPostmark(withAuth(basic("postmark:hunter3")))).toBe(false);
    expect(isPostmark(withAuth(basic("postmark:hunter")))).toBe(false);
    expect(isPostmark(withAuth())).toBe(false);
  });

  it("accepts nothing until the credentials are set", () => {
    vi.stubEnv("POSTMARK_WEBHOOK_PASSWORD", "");
    expect(isPostmark(withAuth(basic("postmark:")))).toBe(false);
  });
});

describe("deliveryProblem", () => {
  it("is a hard bounce when Postmark suppressed the address, with its reason, and whether it can be reset", () => {
    expect(
      deliveryProblem({
        RecordType: "Bounce",
        MessageID: "msg-1",
        Type: "HardBounce",
        Description: "Unknown user",
        Email: "Test-MP@parliament.example",
        Inactive: true,
        CanActivate: true,
      }),
    ).toEqual({
      address: "Test-MP@parliament.example",
      messageId: "msg-1",
      kind: "hard",
      reason: "Unknown user",
      canReset: true,
      details: { type: "HardBounce" },
    });
  });

  it("is a soft bounce when Postmark didn't suppress the address", () => {
    expect(deliveryProblem({ RecordType: "Bounce", Type: "SoftBounce", Email: "a@example.org" })).toEqual({
      address: "a@example.org",
      messageId: null,
      kind: "soft",
      reason: "",
      canReset: false,
      details: { type: "SoftBounce" },
    });
  });

  it("is a complaint for a spam complaint", () => {
    expect(deliveryProblem({ RecordType: "SpamComplaint", MessageID: "m", Email: "a@example.org" })).toMatchObject({
      kind: "complaint",
    });
  });

  it("is nothing for other records, or one with no address", () => {
    expect(deliveryProblem({ RecordType: "Delivery", Email: "a@example.org" })).toBeUndefined();
    expect(deliveryProblem({ RecordType: "Bounce", MessageID: "msg-1" })).toBeUndefined();
    expect(deliveryProblem({})).toBeUndefined();
  });

  it("is nothing for an automatic reply, which Postmark reports as a bounce", () => {
    expect(
      deliveryProblem({ RecordType: "Bounce", Type: "AutoResponder", Email: "a@example.org", MessageID: "msg-1" }),
    ).toBeUndefined();
  });
});
