import type { FormResult } from "@/lib/form-result";
import type { Mark } from "@/lib/politicians/edits.server";
import Tag from "@/components/ui/Tag";
import { Refusal, ResultForm } from "../ui/ResultForm";
import styles from "./PoliticianMarks.module.css";
import { politiciansCopy } from "./copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";

const copy = politiciansCopy.politician;

const MARKS: Mark[] = ["importantTarget", "personalConnection"];

/** A mark's tag's colour, as the politicians list has it: an important target amber, the rest plain. */
const TONES: Partial<Record<Mark, "amber">> = { importantTarget: "amber" };

/** Turns a mark the way its form says (the politicians' setMarkNow), and is never refused. */
export type SetMark = (form: FormData) => Promise<FormResult<never>>;

/** A mark as a lozenge: on, filled, as the politicians list's tag; off, an empty dashed one. */
function Lozenge({ on, tone, children }: { on: boolean; tone?: "amber"; children: string }) {
  return on ? <Tag tone={tone}>{children}</Tag> : <span className={styles.off}>{children}</span>;
}

/**
 * The marks staff set on a politician, a lozenge each, side by side: filled
 * while it's on, as the politicians list shows it, empty and dashed while
 * it's off. Pressing one turns it the other way, in a form of its own,
 * which says under it if that failed. Without `setMark`, they show where
 * each stands and can't be pressed. Last, if they're one of our test
 * politicians, its tag, which no one can change.
 */
export default function PoliticianMarks({
  politician,
  setMark,
}: {
  politician: { id: number; isTest: boolean } & Record<Mark, boolean>;
  setMark?: SetMark;
}) {
  return (
    <div className={styles.marks}>
      {MARKS.map((mark) => {
        const lozenge = (
          <Lozenge on={politician[mark]} tone={TONES[mark]}>
            {copy[mark]}
          </Lozenge>
        );
        return setMark ? (
          <ResultForm key={mark} action={setMark} says={{}}>
            <input type="hidden" name="politicianId" value={politician.id} />
            <input type="hidden" name="mark" value={mark} />
            <input type="hidden" name="on" value={String(!politician[mark])} />
            <button type="submit" role="switch" aria-checked={politician[mark]} className={styles.mark}>
              {lozenge}
            </button>
            <Refusal />
          </ResultForm>
        ) : (
          <button
            key={mark}
            type="button"
            role="switch"
            aria-checked={politician[mark]}
            disabled
            className={styles.mark}
          >
            {lozenge}
          </button>
        );
      })}
      {politician.isTest && (
        <button type="button" role="switch" aria-checked disabled className={styles.mark}>
          <Lozenge on>{staffVocabulary.politicianFlags.test}</Lozenge>
        </button>
      )}
    </div>
  );
}
