"use client";

import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/Controls";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import {
  MOST_BUTTON_CHARACTERS,
  MOST_LINK_BUTTONS,
  MOST_TEXT_BUTTONS,
  type TextButton,
} from "@/lib/broadcasts/text-parts";
import styles from "./TextButtons.module.css";

const copy = broadcastsCopy.broadcastPages.replyButtons;

/**
 * A text's buttons, under its words, a row each in a table with no column
 * headings, each box saying what goes in it: what kind it is, a reply
 * button, whose tap comes back as the person's reply, or a link button,
 * which opens a page; its words; a link's address, a column only while
 * there's a link; and Remove.
 * Under them, + Link button and + Reply button: a text's buttons are all
 * one kind, three at most, and no more than two links (MOST_TEXT_BUTTONS),
 * so once there's one, only its kind's. Their words and addresses are the
 * template's, so only new words can change them (`fixed` shows them as they
 * are, and nothing for none).
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
  const full = buttons.length >= MOST_TEXT_BUTTONS;
  return (
    <div className={styles.buttons}>
      {buttons.length > 0 && (
        <table className={styles.table}>
          <caption className={styles.heading}>{copy.heading}</caption>
          <tbody>
            {buttons.map((button, i) => {
              const link = button.url !== undefined;
              return (
                <tr key={i}>
                  <td className={styles.kind}>{link ? copy.link : copy.reply}</td>
                  <td>
                    <TextInput
                      aria-label={copy.words}
                      placeholder={copy.words}
                      value={button.text}
                      maxLength={MOST_BUTTON_CHARACTERS}
                      disabled={fixed}
                      onChange={(event) => set(i, { ...button, text: event.target.value })}
                    />
                  </td>
                  {links > 0 && (
                    <td>
                      {link && (
                        <TextInput
                          aria-label={copy.address}
                          type="url"
                          placeholder={copy.address}
                          value={button.url}
                          disabled={fixed}
                          onChange={(event) => set(i, { ...button, url: event.target.value })}
                        />
                      )}
                    </td>
                  )}
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
          {replies === 0 && (
            <Button
              variant="ghost"
              size="small"
              fit
              disabled={links >= MOST_LINK_BUTTONS}
              onClick={() => onChange([...buttons, { text: "", url: "" }])}
            >
              {copy.addLink}
            </Button>
          )}
          {links === 0 && (
            <Button
              variant="ghost"
              size="small"
              fit
              disabled={full}
              onClick={() => onChange([...buttons, { text: "" }])}
            >
              {copy.addReply}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
