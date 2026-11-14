import type { Mark } from "@/lib/politicians/edits.server";
import styles from "./PoliticianMarks.module.css";
import { politiciansCopy } from "./copy";

const copy = politiciansCopy.politician;

const MARKS: Mark[] = ["importantTarget", "personalConnection"];

/**
 * The marks staff set on a politician, a row each: its name and a switch,
 * on or off, that turns it the other way, in a form of its own. Without
 * `setMark`, the switches show where each stands and can't be pressed.
 * Last, whether they're one of our test politicians, as a switch no one
 * can move.
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
          <span id={`mark-${mark}`}>{copy[mark]}</span>
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
        <span id="mark-test">{politiciansCopy.politicians.flags.test}</span>
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
