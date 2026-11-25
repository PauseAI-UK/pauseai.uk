import { textShown, type WrittenText as Written } from "@/lib/broadcasts/text-shown";
import NotIcon from "../ui/NotIcon";
import { partButton, partButtonWords } from "../mailings/PartBox";
import TextBubble from "./TextBubble";
import styles from "./Broadcasts.module.css";

/**
 * A text as it was written, as supporters see it: with a second version,
 * both, one under the other, each headed by who it's for in the look of an
 * email's parts, worded as `labels` say it (a condition's words by its ID):
 * the version for those who meet its condition, then everyone else's.
 */
export default function WrittenText({
  written,
  labels,
  time,
  realMaps,
}: {
  written: Written;
  labels: Record<string, string>;
  time: string;
  /** Whether a map is OpenStreetMap's, or a drawing. */
  realMaps?: boolean;
}) {
  const condition = written.textVersion?.condition;
  const bubble = (met: boolean) => {
    const shown = textShown(written, met);
    return (
      <TextBubble
        words={{ content: shown.blocks }}
        footer={shown.footer}
        time={time}
        place={shown.place}
        picture={shown.picture}
        buttons={shown.buttons}
        realMap={realMaps}
      />
    );
  };
  if (!condition) return bubble(false);
  const who = labels[condition] ?? condition;
  return (
    <div className={styles.writtenText}>
      {[true, false].map((met) => (
        <div key={String(met)} className={styles.writtenVersion}>
          <span className={partButton(!met)}>
            {!met && <NotIcon />}
            <span className={partButtonWords}>{who}</span>
          </span>
          {bubble(met)}
        </div>
      ))}
    </div>
  );
}
