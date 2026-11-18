import { AGREED_STATUSES, isAnswer, type AskKind, type AskStatus, type RecordedStatus } from "@/lib/asks/asks";
import { standingWord } from "@/lib/asks/copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import styles from "./AnswerWord.module.css";

/**
 * Someone's answer to an ask, or with the ask's `kind`, where they stand on
 * it (standing(), lib/asks/asks.ts): that they were asked, or with null
 * never were, in that kind's words. In words: a yes ticked in green, a no
 * crossed, the rest plain.
 */
export default function AnswerWord(props: { status: AskStatus } | { status: RecordedStatus | null; kind: AskKind }) {
  const { status } = props;
  const mark = isAnswer(status) && (AGREED_STATUSES.includes(status) ? styles.yes : status === "declined" && styles.no);
  const words = "kind" in props ? standingWord(status, props.kind) : staffVocabulary.statuses[status!];
  return <span className={mark || undefined}>{words}</span>;
}
