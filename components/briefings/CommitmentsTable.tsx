import type { ReactNode } from "react";
import { toneStyle, type BriefingTone } from "./tone";
import styles from "./CommitmentsTable.module.css";

/** Whether a text commits to a thing: it does, in part, or not at all. */
export type Commitment = "yes" | "part" | "no";

/**
 * A text, such as a joint statement: its name and date over its column, and
 * a verdict under it, such as whether the UK signed, ruled in its tone.
 */
export type CommittingText = {
  name: string;
  date: string;
  verdict: { label: string; tone: BriefingTone; dashed?: boolean };
};

/** A thing a text can commit to, and whether each text does, in the columns' order. */
export type CommitmentRow = { name: string; commitments: Commitment[] };

/**
 * What each of a few texts commits to: a column a text, each framed in its
 * box's colour (--tone), and a row a thing it might commit to, marked with a
 * tick, half a circle or a dash. `meanings` says what each mark means, as the
 * caption's key does, for those who can't see the marks.
 */
export default function CommitmentsTable({
  label,
  texts,
  rows,
  meanings,
  caption,
  cite,
}: {
  label: string;
  texts: CommittingText[];
  rows: CommitmentRow[];
  meanings: Record<Commitment, string>;
  caption: ReactNode;
  /** The sources' footnote marks. */
  cite: ReactNode;
}) {
  return (
    <figure className={styles.figure}>
      <table className={styles.table} aria-label={label}>
        <thead>
          <tr>
            <td />
            {texts.map((text) => (
              <th key={text.name} scope="col" className={styles.text}>
                <span className={styles.name}>{text.name}</span>
                <span className={styles.date}>{text.date}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row" className={styles.thing}>
                {row.name}
              </th>
              {row.commitments.map((commitment, i) => (
                <td key={texts[i].name} className={styles.mark}>
                  <Mark commitment={commitment} meaning={meanings[commitment]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            {texts.map((text) => (
              <td key={text.name} className={styles.verdictCell}>
                <span
                  className={styles.verdict}
                  data-dashed={text.verdict.dashed ? "" : undefined}
                  style={toneStyle(text.verdict.tone)}
                >
                  {text.verdict.label}
                </span>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
      <figcaption className={styles.caption}>
        <span>{caption}</span>
        <span>{cite}</span>
      </figcaption>
    </figure>
  );
}

/** A tick in a circle, a half-filled circle, or a grey dash. */
function Mark({ commitment, meaning }: { commitment: Commitment; meaning: string }) {
  return (
    <svg
      className={styles[commitment]}
      viewBox="0 0 24 24"
      width="24"
      height="24"
      role="img"
      aria-label={meaning}
      data-commitment={commitment}
    >
      {commitment === "no" ? (
        <line x1="6" y1="12" x2="18" y2="12" />
      ) : (
        <>
          {commitment === "part" && <path d="M12 2 A10 10 0 0 0 12 22 Z" className={styles.half} />}
          <circle cx="12" cy="12" r="10" />
          {commitment === "yes" && <path d="M7 12.5 l3.2 3.2 L17 8.8" />}
        </>
      )}
    </svg>
  );
}
