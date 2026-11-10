import { AGREED_STATUSES, type AskStatus } from "@/lib/asks";
import { staffCopy } from "@/lib/content/staff-interface";
import styles from "./AnswerWord.module.css";

/** Someone's answer to an ask, or null for none, in words: a yes ticked in green, a no crossed, the rest plain. */
export default function AnswerWord({ status }: { status: AskStatus | null }) {
  const mark =
    status && (AGREED_STATUSES.includes(status) ? styles.yes : status === "declined" ? styles.no : undefined);
  return <span className={mark ?? undefined}>{staffCopy.statuses[status ?? "noAnswer"]}</span>;
}
