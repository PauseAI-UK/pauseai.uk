import { AGREED_STATUSES, INVITED, isAnswer, type AskKind, type AskStatus, type RecordedStatus } from "@/lib/asks/asks";
import { standingWord } from "@/lib/asks/copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import styles from "./AnswerWord.module.css";

/**
 * Someone's answer to an ask, or with the ask's `kind`, where they stand on
 * it (standing(), lib/asks/asks.ts): that they were asked, or with null
 * never were, in that kind's words; `waiting`, that they were asked as the
 * choice beside the answers says it, "(no reply yet)" on a line of its own.
 * In words: a yes ticked in green, a no crossed, the rest plain.
 */
export default function AnswerWord(
  props: { status: AskStatus } | { status: RecordedStatus | null; kind: AskKind; waiting?: boolean },
) {
  const { status } = props;
  if ("kind" in props && props.waiting && status === INVITED) {
    return (
      <span>
        {standingWord(status, props.kind)} <span className={styles.after}>{staffVocabulary.noReplyYetAfter}</span>
      </span>
    );
  }
  const mark = isAnswer(status) && (AGREED_STATUSES.includes(status) ? styles.yes : status === "declined" && styles.no);
  const words = "kind" in props ? standingWord(status, props.kind) : staffVocabulary.statuses[status!];
  return <span className={mark || undefined}>{words}</span>;
}
