import type { ReactNode } from "react";
import IconButton, { CrossIcon, iconButtonClass } from "@/components/ui/IconButton";
import { mailingsCopy } from "./copy";
import styles from "./PartBox.module.css";

const copy = mailingsCopy.mailingEditor;

/**
 * A part's box's classes, for the letter's editor (MailingEditor), which
 * draws each part as ProseMirror does, not with React: the box, its label,
 * its body and its ×.
 */
export const partBox = {
  box: styles.box,
  label: styles.label,
  body: styles.body,
  close: iconButtonClass("outline", styles.close),
};

/** A button's class in a part's look: green, or grey for all but some (`except`), as ConditionMenu's and a text's version tabs. */
export const partButton = (except: boolean): string => (except ? styles.exceptButton : styles.button);

/** Its words' class: on one line, cut short where there's no room. */
export const partButtonWords = styles.words;

/**
 * A part only some recipients get, in a green dashed box under who it's
 * for, or a grey one for all but some (`except`). With `onForEveryone`, a
 * × in its corner makes it for everyone.
 */
export default function PartBox({
  label,
  except = false,
  onForEveryone,
  children,
}: {
  label: string;
  except?: boolean;
  onForEveryone?: () => void;
  children: ReactNode;
}) {
  return (
    <div className={styles.box} data-except={except || undefined} data-closable={onForEveryone ? "" : undefined}>
      <div className={styles.label}>{label}</div>
      {onForEveryone && (
        <IconButton
          look="outline"
          className={styles.close}
          aria-label={copy.forEveryone}
          title={copy.forEveryone}
          onClick={onForEveryone}
        >
          <CrossIcon size={12} />
        </IconButton>
      )}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
