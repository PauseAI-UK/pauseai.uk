import Tag from "@/components/ui/Tag";
import Shortened from "../ui/Shortened";
import styles from "./BounceReason.module.css";
import { emailCopy } from "./copy";

/** Where a problem came from: a hold, from CiviCRM; a bounce found in someone's Gmail; else Postmark, which told us. */
export function problemSource({ kind, foundInGmail }: { kind: string; foundInGmail: boolean }): string {
  return emailCopy.emails.from[kind === "hold" ? "civicrm" : foundInGmail ? "gmail" : "postmark"];
}

/**
 * A mail server's reason, cut to its first sentence, or null when there's
 * nothing after it: without the status codes servers put before it and on
 * each line ("550-5.1.1", "554 5.7.1"), and a bracketed tag at its start
 * ("[HM08]").
 */
export function firstSentence(reason: string): string | null {
  const words = reason
    .replace(/\b[245]\d\d[ -](?:[245]\.\d{1,3}\.\d{1,3}\b)?/g, "")
    .replace(/^\s*\[[^\]]*\]/, "")
    .replace(/\s+/g, " ")
    .trim();
  const first = /^.*?[.!?](?=\s)/.exec(words)?.[0];
  return first ?? null;
}

/**
 * Why an address bounced or was blocked, in the words of whoever told us,
 * then who that was, as a lozenge; never squeezed narrower than a few words,
 * so on a phone its table scrolls sideways instead. A reason longer than
 * its first sentence shows that, and unfolds to the whole of it
 * (ui/Shortened); its lozenge just after, either way.
 */
export default function BounceReason({
  reason,
  kind,
  foundInGmail,
}: {
  reason: string;
  kind: string;
  foundInGmail: boolean;
}) {
  const short = firstSentence(reason);
  const source = <Tag>{problemSource({ kind, foundInGmail })}</Tag>;
  if (!short) {
    return (
      <span className={styles.reason}>
        {reason} {source}
      </span>
    );
  }
  return (
    <span className={styles.reason}>
      <Shortened short={short} whole={reason}>
        {source}
      </Shortened>
    </span>
  );
}
