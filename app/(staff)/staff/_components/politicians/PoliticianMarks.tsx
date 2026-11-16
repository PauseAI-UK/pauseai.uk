import type { Mark } from "@/lib/politicians/edits.server";
import Tag from "@/components/ui/Tag";
import styles from "./PoliticianMarks.module.css";
import { politiciansCopy } from "./copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";

const copy = politiciansCopy.politician;

const MARKS: Mark[] = ["importantTarget", "personalConnection"];

/** A mark's tag's colour, as the politicians list has it: an important target amber, the rest plain. */
const TONES: Partial<Record<Mark, "amber">> = { importantTarget: "amber" };

/** A mark's name: while it's on, in its tag, as the politicians list shows it; off, plain. */
function Name({ on, tone, children }: { on: boolean; tone?: "amber"; children: string }) {
  return on ? <Tag tone={tone}>{children}</Tag> : children;
}

/**
 * The marks staff set on a politician, a row each: its name, in its tag
 * while it's on, and a switch, on or off, that turns it the other way, in a
 * form of its own. Without `setMark`, the switches show where each stands
 * and can't be pressed. Last, whether they're one of our test politicians,
 * as a switch no one can move.
 */
export default function PoliticianMarks({
  politician,
  setMark,
}: {
  politician: { id: number; isTest: boolean } & Record<Mark, boolean>;
  setMark?: (form: FormData) => void | Promise<void>;
}) {
  return (
    <ul className={styles.marks}>
      {MARKS.map((mark) => (
        <li key={mark} className={styles.mark}>
          <span id={`mark-${mark}`}>
            <Name on={politician[mark]} tone={TONES[mark]}>
              {copy[mark]}
            </Name>
          </span>
          <form action={setMark}>
            <input type="hidden" name="politicianId" value={politician.id} />
            <input type="hidden" name="mark" value={mark} />
            <input type="hidden" name="on" value={String(!politician[mark])} />
            <button
              type="submit"
              role="switch"
              aria-checked={politician[mark]}
              aria-labelledby={`mark-${mark}`}
              disabled={!setMark}
              className={styles.switch}
            >
              <span className={styles.knob} />
            </button>
          </form>
        </li>
      ))}
      <li className={styles.mark}>
        <span id="mark-test">
          <Name on={politician.isTest}>{staffVocabulary.politicianFlags.test}</Name>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={politician.isTest}
          aria-labelledby="mark-test"
          disabled
          className={styles.switch}
        >
          <span className={styles.knob} />
        </button>
      </li>
    </ul>
  );
}
