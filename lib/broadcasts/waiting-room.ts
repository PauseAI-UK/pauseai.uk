import type { Refused } from "@/lib/form-result";
import type { SpamReason } from "@/lib/content/spam-check";

// The waiting room (docs/domain-concepts.md, "The waiting room"), in what
// both the site and the server need: where someone is in it, the message the
// /whatsapp/beta page types for them, and how a message is known to be one
// asking to join.

/** Where someone is: welcomed with no reply yet, held for staff, let in, or dismissed for good. */
export const WAITING_STATES = ["held", "let-in", "dismissed", "asked"] as const;
export type WaitingState = (typeof WAITING_STATES)[number];

export function isWaitingState(value: string): value is WaitingState {
  return (WAITING_STATES as readonly string[]).includes(value);
}

/** The waiting room page's tab its `show` asks for: held, unless it names another. */
export function waitingStateOf(show: string | undefined): WaitingState {
  return show && isWaitingState(show) ? show : "held";
}

/** A button's code, as it goes in the message it types: "parents", "footer". */
const CODE = /^[a-z0-9-]{1,40}$/;

/** The code for a page with no utm_source, or one that isn't a code. */
export const SITE_CODE = "site";

/** The code a page's utm_source makes: as it is, in lower case, if it can be one; else SITE_CODE. */
export function cameFromCode(utmSource: string | null | undefined): string {
  const code = (utmSource ?? "").trim().toLowerCase();
  return CODE.test(code) ? code : SITE_CODE;
}

/** What the button types for them: words, then the code in brackets, which says where they came from. */
export function joinMessage(words: string, code: string): string {
  return `${words} (${code})`;
}

/** A code in brackets, as the button types it: anywhere in a message that asks to join, else at its end. */
const CODE_IN_BRACKETS = /\(([a-z0-9-]{1,40})\)/i;
const CODE_AT_END = /\(([a-z0-9-]{1,40})\)\s*$/i;

/** "join", "joining", in any case. */
const ASKS_TO_JOIN = /\bjoin/i;

/**
 * Whether a message asks to join, as the button's does, though they may
 * have changed it before sending: "join" anywhere, or the button's code in
 * brackets at its end. Says where they came from: the code, or null where
 * it has none. Undefined for a message that doesn't ask.
 */
export function asksToJoin(words: string): { cameFrom: string | null } | undefined {
  const code = (ASKS_TO_JOIN.test(words) ? CODE_IN_BRACKETS : CODE_AT_END).exec(words)?.[1]?.toLowerCase();
  if (code) return { cameFrom: code };
  return ASKS_TO_JOIN.test(words) ? { cameFrom: null } : undefined;
}

/**
 * What the waiting room's page is answered (app/api/whatsapp/waiting-room):
 * the link that opens a chat with our number, the message typed in it; or
 * why not, the spam check's reason, or "closed" while our number can't be
 * reached.
 */
export type ChatLinkResult = { ok: true; link: string } | Refused<SpamReason | "closed">;

/** A link that opens a WhatsApp chat with `number` (as +447…, or with spaces), `text` typed in its message box. */
export function chatLink(number: string, text: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}

/** A WhatsApp community's or group's invite link, as staff paste it. */
const INVITE_LINK = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/;

/** An invite link as pasted, trimmed and without anything after its code (WhatsApp adds `?s=…` when shared), or null if it isn't one. */
export function inviteLink(pasted: string): string | null {
  const link = pasted.trim().replace(/[?#].*$/, "");
  return INVITE_LINK.test(link) ? link : null;
}
