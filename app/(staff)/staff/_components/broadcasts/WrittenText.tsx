import type { LinkCard } from "@/lib/broadcasts/link-card";
import { textShown, type WrittenText as Written } from "@/lib/broadcasts/text-shown";
import NotIcon from "../ui/NotIcon";
import { partButton, partButtonWords } from "../mailings/PartBox";
import { mailingsCopy } from "../mailings/copy";
import TextBubble from "./TextBubble";
import styles from "./Broadcasts.module.css";

/**
 * A text as it was written, as supporters see it: with a second version,
 * both, one under the other, each headed by who it's for in the look of an
 * email's parts, worded as `labels` say it (a condition's words by its ID):
 * the version for those who meet its condition, then everyone else's. The
 * two headings look different but have the same words, so each version is a
 * group named as its part's box is in the writer: only for those, or except
 * those.
 */
export default function WrittenText({
  written,
  labels,
  time,
  realMaps,
  cards = {},
}: {
  written: Written;
  labels: Record<string, string>;
  time: string;
  /** Whether a map is OpenStreetMap's, or a drawing. */
  realMaps?: boolean;
  /** Its link cards, by the address each is for (cardLink). */
  cards?: Record<string, LinkCard | null>;
}) {
  const condition = written.textVersion?.condition;
  const bubble = (met: boolean) => {
    const shown = textShown(written, met);
    return (
      <TextBubble
        words={{ content: shown.blocks }}
        card={shown.link ? cards[shown.link] : null}
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
        <div
          key={String(met)}
          role="group"
          aria-label={met ? mailingsCopy.mailingEditor.onlyForLabel(who) : mailingsCopy.mailingEditor.exceptLabel(who)}
          className={styles.writtenVersion}
        >
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
