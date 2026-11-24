import { createHash } from "node:crypto";

// IDs for the fakes of services that make them (Postmark's MessageID,
// Gmail's message IDs), the same every run for the same email.

/** Every UUID in some text. */
export const UUIDS = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** A UUID-shaped id that depends only on `text`. */
export function fixtureUuid(text: string): string {
  const hex = createHash("sha256").update(text).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
