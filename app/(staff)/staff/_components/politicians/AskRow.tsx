"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { buttonClass } from "@/components/ui/Button";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Segmented, TextInput } from "@/components/ui/Controls";
import { FilterForm } from "@/components/ui/Form";
import { ANSWER_CHOICES, INVITED, standing } from "@/lib/asks/asks";
import { standingWord } from "@/lib/asks/copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { answeredByHand } from "@/lib/email-your-mp";
import type { Ask } from "@/lib/asks/records.server";
import type { Politician } from "@/lib/politicians/records.server";
import { staffDate } from "@/lib/staff-time";
import AnswerWord from "../asks/AnswerWord";
import { AskLead } from "../asks/AskLine";
import { BubbleBox } from "@/components/ui/Bubble";
import { bubbleTrigger } from "@/components/ui/bubble-trigger";
import Menu from "../ui/Menu";
import { staffMemberText } from "@/lib/staff-member";
import styles from "../ui/Details.module.css";
import { politiciansCopy } from "./copy";

const copy = politiciansCopy.politician;

type SetStatus = (form: FormData) => void | Promise<void>;

/**
 * Setting where they stand on an ask staff record, with a note: that they
 * were asked, then the answers its kind allows (ANSWER_CHOICES), all in a row
 * to pick from, and Save, which sends the one picked. Once something's
 * recorded, that they were never asked is one to pick too, set apart from the
 * rest, to clear it. Not when a letter put the ask to them, as then they
 * were asked whatever's recorded: asked is what clears it, and stands for
 * nothing recorded.
 */
function AnswerForm({ politician, ask, setStatus }: { politician: Politician; ask: Ask; setStatus: SetStatus }) {
  const current = politician.statuses[ask.slug]?.status ?? "";
  const byLetter = Boolean(politician.askedByLetter[ask.slug]);
  const [chosen, setChosen] = useState<string>(current);
  return (
    <FilterForm action={setStatus} aria-label={`${copy.setStatus}: ${ask.title}`}>
      <input type="hidden" name="politicianId" value={politician.id} />
      <input type="hidden" name="ask" value={ask.slug} />
      <span className={styles.statusChoices}>
        <Segmented
          label={copy.status}
          options={[
            { value: byLetter && current !== INVITED ? "" : INVITED, label: staffVocabulary.noReplyYet[ask.kind] },
            ...ANSWER_CHOICES[ask.kind].map((value) => ({
              value: value as string,
              label: staffVocabulary.statuses[value],
            })),
            ...(current && !byLetter ? [{ value: "", label: standingWord(null, ask.kind), quiet: true }] : []),
          ]}
          value={chosen}
          onChange={setChosen}
        />
      </span>
      <label className={styles.note}>
        <span className={styles.noteLabel}>{copy.note}</span>
        <TextInput name="note" placeholder={copy.notePlaceholder} required />
      </label>
      <SubmitButton variant="primary" size="small" name="status" value={chosen} disabled={!chosen && !current}>
        {copy.save}
      </SubmitButton>
    </FilterForm>
  );
}

/** Ask rows, each its words in one column and its answer in the next, lined up from row to row: a politician's asks, or a letter's. */
export function AskRows({ children }: { children: ReactNode }) {
  return <div className={styles.asks}>{children}</div>;
}

/** Answers that are a no, crossed; a yes (AGREED_STATUSES) is ticked in green. */

/**
 * One ask, a row of the asks card: who asked them to do what, leading into
 * the ask's title and its date; the note and who set the answer, or which
 * import; beside it, in a column of its own, where they stand on it
 * (standing(), lib/asks/asks.ts) and its date, a yes ticked in green and a
 * no crossed, and for an ask staff record, Edit under it, which opens the
 * form to change it in a bubble below. With nothing recorded, the date is
 * that of the last letter that put the ask to them. `open`
 * opens it at once, scrolled to, for an ask just added to the card, and `onClose` is
 * told when it closes.
 */
export default function AskRow({
  politician,
  ask,
  setStatus,
  open = false,
  onClose,
}: {
  politician: Politician;
  ask: Ask;
  setStatus: SetStatus;
  open?: boolean;
  onClose?: () => void;
}) {
  const status = politician.statuses[ask.slug];
  const when = status ? status.date && new Date(status.date) : politician.askedByLetter[ask.slug];
  const byHand = answeredByHand(ask.slug);
  const editId = `edit-${ask.slug}`;
  const popover = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    // On the page, the row, then its bubble under it, as much as fits with the row's top in view (BubbleBox's keep).
    // At once, as the bubble scrolls (BubbleBox): what's in it is there to be pressed.
    row.current!.scrollIntoView({ block: "nearest", behavior: "instant" });
    popover.current!.showPopover();
  }, [open]);
  useEffect(() => {
    const bubble = popover.current;
    if (!bubble || !onClose) return;
    const closed = (event: Event) => {
      if ((event as ToggleEvent).newState === "closed") onClose();
    };
    bubble.addEventListener("toggle", closed);
    return () => bubble.removeEventListener("toggle", closed);
  }, [onClose]);
  return (
    <div
      ref={row}
      className={styles.ask}
      role="group"
      aria-label={ask.title}
      // What its bubble opens under on a phone (Details.module.css).
      style={{ anchorName: `--row-${ask.slug}`, "--row-anchor": `--row-${ask.slug}` } as CSSProperties}
    >
      <div className={styles.asked}>
        <AskLead ask={ask} />
        {status && (
          <span className={styles.askMeta}>
            {status.note && `${status.note} · `}
            {copy.fromImport[status.updatedBy] ?? copy.answerSetBy(staffMemberText(status.updatedBy))}
          </span>
        )}
      </div>
      <div className={styles.answer}>
        <AnswerWord status={standing(politician, ask.slug)} kind={ask.kind} waiting />
        {when && <span className={styles.askMeta}>{staffDate(when)}</span>}
        {byHand && (
          <button type="button" className={styles.edit} {...bubbleTrigger(editId)}>
            {copy.edit}
          </button>
        )}
      </div>
      {byHand && (
        // Keyed on the answer, so a change made from it closes it and empties the note.
        <BubbleBox
          key={status?.updatedAt.toISOString() ?? "none"}
          ref={popover}
          keep={row}
          id={editId}
          className={styles.editPopover}
        >
          <AnswerForm politician={politician} ask={ask} setStatus={setStatus} />
        </BubbleBox>
      )}
    </div>
  );
}

/**
 * A politician's asks card: a row for each ask they've answered or been
 * asked, then under them a small button whose menu lists the other asks
 * staff record by hand. One chosen joins the rows in its place, as the asks
 * are ordered, as never asked and its form open; closed with nothing set,
 * it's back in the menu at once. Once something's recorded, it's one of
 * theirs, and if that's cleared, with no letter having asked them, it's back
 * in the menu.
 */
export function PoliticianAsks({
  politician,
  asks,
  setStatus,
}: {
  politician: Politician;
  asks: Ask[];
  setStatus: SetStatus;
}) {
  const [added, setAdded] = useState<string[]>([]);
  const asked = (ask: Ask) => standing(politician, ask.slug) !== null;
  // One they've been asked is a row of its own now, so it's no longer one added here.
  const still = added.filter((slug) => asks.some((ask) => ask.slug === slug && !asked(ask)));
  if (still.length < added.length) setAdded(still);
  const rows = asks.filter((ask) => asked(ask) || added.includes(ask.slug));
  const left = asks.filter((ask) => answeredByHand(ask.slug) && !rows.includes(ask));
  return (
    <AskRows>
      {rows.map((ask) => (
        <AskRow
          key={ask.slug}
          politician={politician}
          ask={ask}
          setStatus={setStatus}
          open={!asked(ask)}
          onClose={asked(ask) ? undefined : () => setAdded((now) => now.filter((slug) => slug !== ask.slug))}
        />
      ))}
      {left.length > 0 && (
        <div className={styles.otherAsks}>
          <Menu
            id="other-asks"
            trigger={buttonClass({ variant: "ghost", size: "small", fit: true })}
            label={copy.otherAsk}
          >
            <ul className={styles.askChoices} aria-label={copy.otherAsk}>
              {left.map((ask) => (
                <li key={ask.slug}>
                  <button
                    type="button"
                    popoverTarget="other-asks"
                    popoverTargetAction="hide"
                    onClick={() => setAdded([...added, ask.slug])}
                  >
                    {ask.title}
                  </button>
                </li>
              ))}
            </ul>
          </Menu>
        </div>
      )}
    </AskRows>
  );
}
