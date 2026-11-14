import { allParts, messageIds, parseHeaders, parseMime, partText, type MimePart } from "./mime.server";

// What a bounce says, wherever it was read from: a connected Gmail
// (lib/server/gmail-reading.server.ts) or the letters inbox
// (lib/server/letters-inbox-reading.server.ts).

/** One address a bounce says failed: what happened, in the server's words and its status code. */
export type BouncedAddress = { address: string; status: string; reason: string; delayed: boolean };

/**
 * What a bounce says: each address that failed, from its delivery report
 * (RFC 3464) or else its X-Failed-Recipients header; and the Message-ID of
 * the email that bounced, from the copy of it or its headers that it
 * carries, or else what the bounce answers.
 */
export function readBounce(raw: string): { addresses: BouncedAddress[]; messageId: string | undefined } {
  const message = parseMime(raw);
  const parts = allParts(message);
  const type = (part: MimePart) => (part.headers.get("content-type") ?? "").toLowerCase();
  const addresses: BouncedAddress[] = [];
  for (const report of parts.filter((part) => type(part).startsWith("message/delivery-status"))) {
    for (const block of partText(report)
      .split(/\r?\n\s*\r?\n/)
      .map(parseHeaders)) {
      const recipient = block.get("final-recipient") ?? block.get("original-recipient");
      if (!recipient) continue;
      const action = (block.get("action") ?? "").toLowerCase();
      if (action !== "failed" && action !== "delayed") continue;
      const status = block.get("status") ?? "";
      addresses.push({
        address: recipient.replace(/^[^;]*;\s*/, "").toLowerCase(),
        status,
        reason: block.get("diagnostic-code")?.replace(/^[^;]*;\s*/, "") ?? status,
        delayed: action === "delayed" || status.startsWith("4"),
      });
    }
  }
  if (!addresses.length) {
    for (const address of (message.headers.get("x-failed-recipients") ?? "").split(",")) {
      if (address.trim())
        addresses.push({ address: address.trim().toLowerCase(), status: "", reason: "", delayed: false });
    }
  }
  const original = parts.find((part) => part !== message && part.headers.has("message-id"));
  const headersPart = parts.find((part) => type(part).startsWith("text/rfc822-headers"));
  const messageId =
    messageIds(original?.headers.get("message-id"))[0] ??
    messageIds(headersPart && parseHeaders(partText(headersPart)).get("message-id"))[0] ??
    [...messageIds(message.headers.get("in-reply-to")), ...messageIds(message.headers.get("references"))][0];
  return { addresses, messageId };
}
