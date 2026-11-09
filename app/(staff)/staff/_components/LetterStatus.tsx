import Tag, { type TagTone } from "@/components/ui/Tag";
import { staffCopy } from "@/lib/content/staff-interface";
import type { SkipReason } from "@/lib/server/mailings";
import styles from "./LetterStatus.module.css";

/** A letter's status, in words. */
export const statusOf = (status: string) => staffCopy.letters.status[status] ?? status;

/**
 * Each status's colour, by the style guide's status colours: red where it
 * didn't arrive or we can't tell, amber where we stopped it, blue while
 * it's going out or about to. The rest are grey.
 */
const TONES: Record<string, TagTone> = {
  not_sent: "red",
  bounced: "red",
  spam_complaint: "red",
  uncertain: "red",
  skipped: "red",
  cancelled: "amber",
  scheduled: "blue",
  sending: "blue",
};

/** How a letter went, as its tag says it: a skip with why, in red, or its status in its colour. */
export function letterStatus({ status, skipReason }: { status: string; skipReason?: SkipReason | null }): {
  words: string;
  tone?: TagTone;
} {
  if (skipReason) return { words: staffCopy.mailingPages.skipReasons[skipReason], tone: "red" };
  return { words: statusOf(status), tone: TONES[status] };
}

/**
 * A letter's tags: how it went (letterStatus), and beside it, never in its
 * place, Answered in green when its politician answered the ask it makes,
 * or else Replied when they replied.
 */
export default function LetterStatus({
  status,
  skipReason,
  answered,
  replied,
}: {
  status: string;
  skipReason?: SkipReason | null;
  answered: boolean;
  replied: boolean;
}) {
  const { words, tone } = letterStatus({ status, skipReason });
  return (
    <span className={styles.tags}>
      <Tag tone={tone}>{words}</Tag>
      {answered ? (
        <Tag tone="green">{staffCopy.mailings.columns.answered}</Tag>
      ) : (
        replied && <Tag>{statusOf("replied")}</Tag>
      )}
    </span>
  );
}
