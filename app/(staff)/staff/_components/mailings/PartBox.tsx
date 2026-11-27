import type { ReactNode } from "react";
import IconButton, { CrossIcon, iconButtonClass } from "@/components/ui/IconButton";
import IconText from "../ui/IconText";
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
 * A small mark in a part's look, beside the name of something with a part
 * only some recipients get: an icon and a word or two, with who the part is
 * for when the mouse is over it (`title`).
 */
export function PartMark({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <span className={styles.mark} title={title}>
      <IconText icon={icon}>{children}</IconText>
    </span>
  );
}

/**
 * A part only some recipients get, in a green dashed box under who it's
 * for, or a grey one for all but some (`except`). With `onRemove`, a ×
 * in its corner that takes it away, named `removeLabel`.
 */
export default function PartBox({
  label,
  except = false,
  onRemove,
  removeLabel,
  children,
}: {
  label: string;
  except?: boolean;
  onRemove?: () => void;
  removeLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className={styles.box} data-except={except || undefined} data-closable={onRemove ? "" : undefined}>
      <div className={styles.label}>{label}</div>
      {onRemove && (
        <IconButton
          look="outline"
          className={styles.close}
          aria-label={removeLabel}
          title={removeLabel}
          onClick={onRemove}
        >
          <CrossIcon size={12} />
        </IconButton>
      )}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
