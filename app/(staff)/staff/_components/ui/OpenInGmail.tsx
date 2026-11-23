"use client";

import { useId } from "react";
import Bubble from "@/components/ui/Bubble";
import { lettersCopy } from "../letters/copy";
import ExternalLink from "./ExternalLink";
import { helpButtonClass } from "./HelpButton";
import IconText from "./IconText";
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
    // The "i" centred on the link's lowercase letters, as a small icon beside words is.
    <IconText
      after
      icon={
        <Bubble id={id} label="i" trigger={helpButtonClass()} name={copy.gmailHelp.name} className={styles.bubble}>
          <strong>{copy.gmailHelp.title(account)}</strong>
          <p className={styles.words}>{copy.gmailHelp.words(account)}</p>
        </Bubble>
      }
    >
      <ExternalLink href={href}>{copy.openInGmail}</ExternalLink>
    </IconText>
  );
}
