/**
 * A random UUID (version 4), made from `crypto.getRandomValues`, which
 * browsers give every page. Their `crypto.randomUUID` is only on secure
 * ones, HTTPS or localhost, so a page served over plain HTTP, as a branch
 * is served to another machine, would have none.
 */
export function uuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // RFC 9562's variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
