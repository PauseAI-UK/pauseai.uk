import { AGREED_STATUSES, type AskKind, type RecordedStatus } from "@/lib/asks/asks";
import { standingWord } from "@/lib/asks/copy";
import styles from "./AnswerWord.module.css";

/**
 * Where someone stands on an ask (standing(), lib/asks/asks.ts), in words: a
 * yes ticked in green, a no crossed, the rest plain. That they were asked,
 * or with null never were, is in the words of the ask's `kind`.
 */
export default function AnswerWord({ status, kind }: { status: RecordedStatus | null; kind?: AskKind }) {
  const mark =
    status &&
    ((AGREED_STATUSES as readonly string[]).includes(status)
      ? styles.yes
      : status === "declined"
        ? styles.no
        : undefined);
  return <span className={mark ?? undefined}>{standingWord(status, kind)}</span>;
}
