import Shortened, { cutAtWord } from "../ui/Shortened";
import styles from "./BounceReason.module.css";
import { emailCopy } from "./copy";

/**
 * Where a problem came from: a hold, from CiviCRM; a text WhatsApp refused;
 * a bounce found in someone's Gmail; else Postmark, which told us.
 */
export function problemSource({ kind, foundInGmail }: { kind: string; foundInGmail: boolean }): string {
  const from = emailCopy.emails.from;
  if (kind === "hold") return from.civicrm;
  if (kind === "not-on-whatsapp") return from.whatsapp;
  return foundInGmail ? from.gmail : from.postmark;
}

/** How much of a reason shows before it's folded: a few words, so it mostly fits on a line. */
export const REASON_LENGTH = 24;

/**
 * The start of a mail server's reason to show for it, or null when there's
 * nothing to fold: its first sentence, cut at a word within REASON_LENGTH,
 * without the status codes servers put before it and on each line
 * ("550-5.1.1", "554 5.7.1"), and a bracketed tag at its start ("[HM08]").
 */
export function shortReason(reason: string): string | null {
  const words = reason
    .replace(/\b[245]\d\d[ -](?:[245]\.\d{1,3}\.\d{1,3}\b)?/g, "")
    .replace(/^\s*\[[^\]]*\]/, "")
    .replace(/\s+/g, " ")
    .trim();
  const first = /^.*?[.!?](?=\s)/.exec(words)?.[0] ?? words;
  return cutAtWord(first, REASON_LENGTH) ?? (first === words ? null : first);
}

/**
 * Why an address bounced or was blocked, in the words of whoever told us
 * (problemSource names who, in a column of its own); never squeezed narrower
 * than a few words, so on a phone its table scrolls sideways instead. A
 * longer reason shows its start (shortReason), and unfolds to the whole of
 * it (ui/Shortened).
 */
export default function BounceReason({ reason }: { reason: string }) {
  const short = shortReason(reason);
  return <span className={styles.reason}>{short ? <Shortened short={short} whole={reason} /> : reason}</span>;
}
