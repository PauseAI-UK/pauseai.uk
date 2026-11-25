"use client";

import { useState } from "react";
import { textShown, type WrittenText as Written } from "@/lib/broadcasts/text-shown";
import NotIcon from "../ui/NotIcon";
import { partButton, partButtonWords } from "../mailings/PartBox";
import TextBubble from "./TextBubble";
import styles from "./Broadcasts.module.css";

/**
 * A text as it was written, as a supporter sees it: everyone else's, and
 * with a second version, a toggle for those who meet its condition, worded
 * as `labels` say it (a condition's words by its ID), as the writer's
 * preview has it.
 */
export default function WrittenText({
  written,
  labels,
  time,
}: {
  written: Written;
  labels: Record<string, string>;
  time: string;
}) {
  const [met, setMet] = useState(false);
  const shown = textShown(written, met);
  const condition = written.textVersion?.condition;
  return (
    <div className={styles.writtenText}>
      {condition && (
        <button type="button" aria-pressed={met} className={partButton(!met)} onClick={() => setMet(!met)}>
          {!met && <NotIcon />}
          <span className={partButtonWords}>{labels[condition] ?? condition}</span>
        </button>
      )}
      <TextBubble
        words={{ content: shown.blocks }}
        footer={shown.footer}
        time={time}
        place={shown.place}
        picture={shown.picture}
        buttons={shown.buttons}
      />
    </div>
  );
}
