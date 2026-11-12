import type { ReactNode } from "react";
import Tag from "@/components/ui/Tag";
import { Muted } from "@/components/ui/Text";
import { staffCopy } from "@/lib/content/staff-interface";
import { monthsAndYears } from "@/lib/dated-groups";
import { now } from "@/lib/now";
import type { CorrespondenceThread, ThreadStep } from "@/lib/politician-correspondence";
import { staffDate } from "@/lib/staff-time";
import styles from "./PoliticianCorrespondence.module.css";
import Empty from "./ui/Empty";
import StaffLink from "./ui/StaffLink";
import Withheld from "./ui/Withheld";
import { statusOf } from "./LetterStatus";

const copy = staffCopy.politician.correspondence;

/** How many threads show before the fold opens the rest. */
const SHOWN = 8;

/** A letter with less of its own words than this is a greeting or a small edit, so isn't marked. */
const OWN_WORDS_WORTH_MARKING = 0.05;

/** One step of a thread, in words: who, whether they began it or replied, and the day. */
function words(step: ThreadStep, first: boolean, sender: string | null): ReactNode {
  const date = staffDate(step.at);
  if (step.auto) return copy.auto(date);
  if (step.who === "us") return first ? copy.sent(date) : copy.usReplied(date);
  // A supporter's letter without its sender, as staff without the permission see it.
  if (step.who === "supporter" && sender === null) {
    return (
      <>
        <Withheld>{staffCopy.politician.history.unsignedLetter}</Withheld> {date}
      </>
    );
  }
  const name = step.name ?? (step.who === "them" ? copy.office : sender!);
  return first ? copy.wrote(name, date) : copy.replied(name, date);
}

function Thread({ thread }: { thread: CorrespondenceThread }) {
  const title =
    thread.title === null ? <Withheld>{staffCopy.oneOff.hidden}</Withheld> : thread.title || staffCopy.oneOff.noSubject;
  return (
    <li>
      {thread.href ? <StaffLink href={thread.href}>{title}</StaffLink> : title}{" "}
      <Tag>{staffCopy.allLetters.topicKinds[thread.kind]}</Tag>
      {thread.status && <Muted> · {statusOf(thread.status)}</Muted>}
      {(thread.ownWords ?? 0) >= OWN_WORDS_WORTH_MARKING && (
        <span className={styles.ownWords}>
          <Tag tone="amber">
            {staffCopy.letters.columns.ownWords} {staffCopy.letters.ownWords(thread.ownWords!)}
          </Tag>
        </span>
      )}
      <div className={styles.trail}>
        {thread.steps.map((step, i) => (
          <span key={i} data-reply={(step.who === "them" && !step.auto) || undefined}>
            {words(step, i === 0, thread.sender)}
          </span>
        ))}
        {thread.noReply && <span>{copy.noReply}</span>}
      </div>
    </li>
  );
}

/**
 * A politician's letters and one-off threads, under their months and years,
 * each its title, leading to its page, and a line of who wrote and when, a
 * real reply stronger than the rest. A supporter's letter with their own words
 * in it says how much. Past the newest few, a fold opens the rest in place.
 */
export default function PoliticianCorrespondence({ threads }: { threads: CorrespondenceThread[] }) {
  if (threads.length === 0) return <Empty>{copy.none}</Empty>;
  const when = (thread: CorrespondenceThread) => thread.at.toISOString();
  const today = now();
  const shown = monthsAndYears(threads.slice(0, SHOWN), when, today);
  const groups = (list: typeof shown, continued?: string): ReactNode =>
    list.map((group) => (
      <div key={group.key} className={styles.group}>
        {group.key !== continued && <h3>{group.heading}</h3>}
        <ul>
          {group.items.map((thread) => (
            <Thread key={thread.key} thread={thread} />
          ))}
        </ul>
      </div>
    ));
  return (
    <div className={styles.threads}>
      {groups(shown)}
      {threads.length > SHOWN && (
        <details className={styles.more}>
          <summary>{copy.all(threads.length)}</summary>
          <div className={styles.threads}>
            {groups(monthsAndYears(threads.slice(SHOWN), when, today), shown[shown.length - 1].key)}
          </div>
        </details>
      )}
    </div>
  );
}
