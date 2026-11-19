import StaffLink from "../ui/StaffLink";
import { askHref } from "@/lib/asks/asks";
import type { Ask } from "@/lib/asks/records.server";
import { staffDate } from "@/lib/staff-time";
import AnswerWord from "./AnswerWord";
import styles from "../ui/Details.module.css";
import { asksCopy } from "@/lib/asks/copy";

/** Who asked and what, as a politician's page says it. */
export function askedLine(ask: Pick<Ask, "askedBy" | "kind">): string {
  const who = new Intl.ListFormat("en-GB").format(ask.askedBy.map((asker) => asksCopy.asks.askedBy[asker]));
  return asksCopy.asks.askedThem(who, ask.kind);
}

/** The ask's title, leading to its page. */
export function AskTitle({ ask }: { ask: Pick<Ask, "slug" | "title"> }) {
  return <StaffLink href={askHref(ask.slug)}>{ask.title}</StaffLink>;
}

/**
 * An ask as a politician's page leads into it: who asked them to do what,
 * then its title, leading to its page but for a preview, whose ask may not
 * exist yet, and after the title its date, if we know it, kept whole.
 */
export function AskLead({ ask, linked = true }: { ask: Ask; linked?: boolean }) {
  return (
    <>
      <span className={styles.askMeta}>{askedLine(ask)}</span>
      <span>
        {linked ? <AskTitle ask={ask} /> : <span>{ask.title}</span>}
        {ask.date && (
          <>
            {" "}
            <span className={`${styles.askMeta} ${styles.askWhen}`}>· {staffDate(new Date(ask.date))}</span>
          </>
        )}
      </span>
    </>
  );
}

/**
 * An ask as it shows among a politician's asks once they've said yes:
 * AskLead, and beside it, in a column of its own, their answer, ticked in
 * green, dated the ask's day if it has one.
 */
export function AskPreview({ ask }: { ask: Ask }) {
  return (
    <div className={styles.asks}>
      <div className={styles.ask} role="group" aria-label={ask.title}>
        <div className={styles.asked}>
          <AskLead ask={ask} linked={false} />
        </div>
        <div className={styles.answer}>
          <AnswerWord status={ask.kind === "letter" ? "signed" : "going"} />
          {ask.date && <span className={styles.askMeta}>{staffDate(new Date(ask.date))}</span>}
        </div>
      </div>
    </div>
  );
}
