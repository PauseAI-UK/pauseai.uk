"use client";

import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Controls";
import { Field, Hint } from "@/components/ui/Field";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { MOST_BUTTON_CHARACTERS, MOST_REPLY_BUTTONS, type ReplyButton } from "@/lib/broadcasts/text-parts";
import styles from "./ReplyButtons.module.css";

const copy = broadcastsCopy.broadcastPages.replyButtons;

/** With this many buttons or more, WhatsApp on a computer says to open the text on a phone. */
const MANY = 4;

/**
 * A text's reply buttons, under its words: each one's words, with Remove,
 * then + Reply button, till there are as many as WhatsApp takes. A tap
 * comes back as the person's reply. Their words are the template's, so
 * only new words can change them (`fixed` shows them as they are, and
 * nothing for none).
 */
export default function ReplyButtons({
  buttons,
  onChange,
  fixed = false,
}: {
  buttons: ReplyButton[];
  onChange: (buttons: ReplyButton[]) => void;
  fixed?: boolean;
}) {
  if (fixed && !buttons.length) return null;
  const set = (i: number, text: string) => onChange(buttons.map((one, j) => (j === i ? { text } : one)));
  return (
    <div className={styles.buttons}>
      <p className={styles.heading}>{copy.heading}</p>
      {buttons.map((button, i) => (
        <div key={i} className={styles.button}>
          <Field label={copy.words}>
            <TextInput
              value={button.text}
              maxLength={MOST_BUTTON_CHARACTERS}
              disabled={fixed}
              onChange={(event) => set(i, event.target.value)}
            />
          </Field>
          {!fixed && (
            <Button variant="ghost" size="small" fit onClick={() => onChange(buttons.filter((_, j) => j !== i))}>
              {copy.remove}
            </Button>
          )}
        </div>
      ))}
      {!fixed && (
        <Button
          variant="ghost"
          size="small"
          fit
          disabled={buttons.length >= MOST_REPLY_BUTTONS}
          onClick={() => onChange([...buttons, { text: "" }])}
        >
          {copy.add}
        </Button>
      )}
      {buttons.length > 0 && <Hint>{copy.tapNote}</Hint>}
      {buttons.length >= MANY && <Hint>{copy.manyNote}</Hint>}
    </div>
  );
}
