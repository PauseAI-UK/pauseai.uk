import type { ReactNode } from "react";
import { staffCopy } from "@/lib/content/staff-interface";
import styles from "./Messages.module.css";

const copy = staffCopy.messagePages;

/**
 * A bubble in a text conversation: theirs at the left in white, ours at the
 * right in green, each with who and when. `fromUs` names it as ours though it's
 * at the left: the message itself, as it reached them.
 */
export function ChatBubble({
  who,
  when,
  ours = false,
  fromUs = ours,
  children,
}: {
  who: string;
  when: string;
  ours?: boolean;
  fromUs?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={ours ? `${styles.bubble} ${styles.ours}` : styles.bubble}>
      <span className={fromUs ? `${styles.name} ${styles.ourName}` : styles.name}>{who}</span>
      {children}
      <span className={styles.time}>{when}</span>
    </div>
  );
}

/** A web address in a text: http(s):// or www., up to a space, less any punctuation ending a sentence after it. */
const URL = /\b(?:https?:\/\/|www\.)[^\s]*[^\s.,!?;:)'"]/g;

/** A text's words with each web address a link, as WhatsApp shows them. */
export function LinkedText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let at = 0;
  for (const match of text.matchAll(URL)) {
    parts.push(text.slice(at, match.index));
    const url = match[0];
    parts.push(
      <a
        key={match.index}
        className={styles.textLink}
        href={url.startsWith("www.") ? `https://${url}` : url}
        target="_blank"
        rel="noreferrer"
      >
        {url}
      </a>,
    );
    at = match.index + url.length;
  }
  parts.push(text.slice(at));
  return <>{parts}</>;
}

/** The wall a text conversation's bubbles sit on. */
export function ChatWall({ children }: { children: ReactNode }) {
  return <div className={styles.wall}>{children}</div>;
}

/**
 * A text as a messaging app shows it: the words in a bubble from us, on the
 * left as it is on their phone, its web addresses links, with the time, and
 * the Stop button under it.
 */
export default function TextBubble({ from, text, time }: { from: string; text: string; time: string }) {
  return (
    <ChatWall>
      <div className={styles.bubble}>
        <span className={`${styles.name} ${styles.ourName}`}>{from}</span>
        <LinkedText text={text} />
        <span className={styles.time}>{time}</span>
      </div>
      <div className={styles.stop}>{copy.stopButton}</div>
    </ChatWall>
  );
}
