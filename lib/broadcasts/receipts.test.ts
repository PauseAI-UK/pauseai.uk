import { describe, expect, it } from "vitest";
import { receiptOf } from "./receipts";

const event = (kind: string, details: Record<string, unknown> = {}) => ({ kind, details });

describe("receiptOf", () => {
  it("is read, then delivered, then sent, the furthest it got", () => {
    expect(receiptOf([])).toEqual({ kind: "sent" });
    expect(receiptOf([event("sent"), event("replied")])).toEqual({ kind: "sent" });
    expect(receiptOf([event("delivered"), event("sent")])).toEqual({ kind: "delivered" });
    expect(receiptOf([event("read"), event("delivered")])).toEqual({ kind: "read" });
  });

  it("is failed, with WhatsApp's why if it gave one, unless it was delivered after all", () => {
    expect(receiptOf([event("failed", { code: 131047, title: "Re-engagement message" })])).toEqual({
      kind: "failed",
      why: "Re-engagement message",
    });
    expect(receiptOf([event("failed", { code: null, title: null })])).toEqual({ kind: "failed", why: null });
    expect(receiptOf([event("delivered"), event("failed")])).toEqual({ kind: "delivered" });
  });
});
