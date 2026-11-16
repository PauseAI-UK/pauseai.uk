// What WhatsApp last said became of a text we sent, a copy of a broadcast
// or our reply to a reply, from its history: as its bubble shows it.

/** What WhatsApp said of a text, as its ticks show it; or that it failed, and why. */
export type Receipt = { kind: "sent" | "delivered" | "read" } | { kind: "failed"; why: string | null };

/**
 * A text's receipt from its history's events: read, then delivered, then
 * failed, the first it has, as a text delivered after a failure went; else
 * sent.
 */
export function receiptOf(events: { kind: string; details: Record<string, unknown> }[]): Receipt {
  const kinds = new Set(events.map((event) => event.kind));
  if (kinds.has("read")) return { kind: "read" };
  if (kinds.has("delivered")) return { kind: "delivered" };
  const failed = events.find((event) => event.kind === "failed");
  if (failed) return { kind: "failed", why: typeof failed.details.title === "string" ? failed.details.title : null };
  return { kind: "sent" };
}
