"use client";

import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Controls";
import { Hint } from "@/components/ui/Field";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import {
  MOST_BUTTON_CHARACTERS,
  MOST_BUTTONS,
  MOST_LINK_BUTTONS,
  type TextButton,
} from "@/lib/broadcasts/text-parts";
import styles from "./TextButtons.module.css";

const copy = broadcastsCopy.broadcastPages.replyButtons;

/** With this many buttons or more, WhatsApp on a computer says to open the text on a phone. */
const MANY = 4;

/**
 * A text's buttons, under its words, a row each in a table: what kind it
 * is, a reply button, whose tap comes back as the person's reply, or a link
 * button, which opens a page; its words; a link's address; and Remove.
 * Under them, + Reply button and + Link button, till there are as many as
 * WhatsApp takes, and no more links than it takes; then what a reply does,
 * and what a computer does with many, or with both kinds. Their words and
 * addresses are the template's, so only new words can change them (`fixed`
 * shows them as they are, and nothing for none).
 */
export default function TextButtons({
  buttons,
  onChange,
  fixed = false,
}: {
  buttons: TextButton[];
  onChange: (buttons: TextButton[]) => void;
  fixed?: boolean;
}) {
  if (fixed && !buttons.length) return null;
  const set = (i: number, button: TextButton) => onChange(buttons.map((one, j) => (j === i ? button : one)));
  const links = buttons.filter((button) => button.url !== undefined).length;
  const replies = buttons.length - links;
  const full = buttons.length >= MOST_BUTTONS;
  return (
    <div className={styles.buttons}>
      {buttons.length > 0 && (
        <table className={styles.table}>
          <caption className={styles.heading}>{copy.heading}</caption>
          <thead>
            <tr>
              <th scope="col">{copy.kind}</th>
              <th scope="col">{copy.words}</th>
              <th scope="col">{copy.address}</th>
              {!fixed && <th scope="col" aria-label={copy.remove} />}
            </tr>
          </thead>
          <tbody>
            {buttons.map((button, i) => {
              const link = button.url !== undefined;
              return (
                <tr key={i}>
                  <td className={styles.kind}>{link ? copy.link : copy.reply}</td>
                  <td>
                    <TextInput
                      aria-label={copy.words}
                      value={button.text}
                      maxLength={MOST_BUTTON_CHARACTERS}
                      disabled={fixed}
                      onChange={(event) => set(i, { ...button, text: event.target.value })}
                    />
                  </td>
                  <td>
                    {link && (
                      <TextInput
                        aria-label={copy.address}
                        type="url"
                        placeholder="https://"
                        value={button.url}
                        disabled={fixed}
                        onChange={(event) => set(i, { ...button, url: event.target.value })}
                      />
                    )}
                  </td>
                  {!fixed && (
                    <td>
                      <Button
                        variant="ghost"
                        size="small"
                        fit
                        onClick={() => onChange(buttons.filter((_, j) => j !== i))}
                      >
                        {copy.remove}
                      </Button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {!fixed && (
        <div className={styles.add}>
          <Button variant="ghost" size="small" fit disabled={full} onClick={() => onChange([...buttons, { text: "" }])}>
            {copy.addReply}
          </Button>
          <Button
            variant="ghost"
            size="small"
            fit
            disabled={full || links >= MOST_LINK_BUTTONS}
            onClick={() => onChange([...buttons, { text: "", url: "" }])}
          >
            {copy.addLink}
          </Button>
        </div>
      )}
      {replies > 0 && <Hint>{copy.tapNote}</Hint>}
      {(buttons.length >= MANY || (replies > 0 && links > 0)) && <Hint>{copy.manyNote}</Hint>}
    </div>
  );
}
