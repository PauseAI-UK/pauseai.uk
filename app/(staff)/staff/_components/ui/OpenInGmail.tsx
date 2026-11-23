"use client";

import { useId } from "react";
import Bubble from "@/components/ui/Bubble";
import { lettersCopy } from "../letters/copy";
import ExternalLink from "./ExternalLink";
import styles from "./OpenInGmail.module.css";

const copy = lettersCopy.lettersInbox;

/**
 * Open in Gmail: a link to a message in `account`'s Gmail, which opens only
 * for someone logged into Gmail as that account. An "i" after it opens what
 * to do if Gmail shows their own inbox instead.
 */
export default function OpenInGmail({ href, account }: { href: string; account: string }) {
  const id = `gmail-help-${useId()}`;
  return (
    <span className={styles.open}>
      <ExternalLink href={href}>{copy.openInGmail}</ExternalLink>
      <Bubble id={id} label="i" trigger={styles.help} name={copy.gmailHelp.name} className={styles.bubble}>
        <strong>{copy.gmailHelp.title(account)}</strong>
        <p className={styles.words}>{copy.gmailHelp.words(account)}</p>
      </Bubble>
    </span>
  );
}
