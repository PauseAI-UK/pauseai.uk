import Tag from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import styles from "./BounceReason.module.css";

/** Where a problem came from: a hold, from CiviCRM; a bounce found in someone's Gmail; else Postmark, which told us. */
export function problemSource({ kind, foundInGmail }: { kind: string; foundInGmail: boolean }): string {
  return staffCopy.emails.from[kind === "hold" ? "civicrm" : foundInGmail ? "gmail" : "postmark"];
}

/**
 * Why an address bounced or was blocked, in the words of whoever told us,
 * then who that was, as a lozenge; never squeezed narrower than a few words,
 * so on a phone its table scrolls sideways instead.
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
  return (
    <span className={styles.reason}>
      {reason} <Tag>{problemSource({ kind, foundInGmail })}</Tag>
    </span>
  );
}
