import { Fragment, type ReactNode } from "react";
import { FIELD_WORDS } from "@/lib/broadcasts/broadcasts";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import type { Receipt } from "@/lib/broadcasts/receipts";
import type { MailingBlock, MailingInline } from "@/lib/mailings/doc";
import IconText from "../ui/IconText";
import letter from "../mailings/MailingLetter.module.css";
import styles from "./Broadcasts.module.css";

const words = broadcastsCopy.broadcastPages;

/** One tick, or two; each a check mark drawn in the colour of the words around it. */
function Ticks({ receipt }: { receipt: "sent" | "delivered" | "read" }) {
  const label = words.events[receipt];
  return (
    <svg
      width="16"
      height="11"
      viewBox="0 0 16 11"
      role="img"
      aria-label={label}
      className={receipt === "read" ? styles.read : undefined}
    >
      <title>{label}</title>
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M1.5 6l3 3 6-6.5" />
        {receipt !== "sent" && <path d="M8 9l6-6.5" />}
      </g>
    </svg>
  );
}

/**
 * A bubble in a text conversation: theirs at the left in white, ours at the
 * right in green, each with who and when; ours with its ticks, or, under its
 * words, that WhatsApp couldn't deliver it.
 */
export function ChatBubble({
  who,
  when,
  ours = false,
  receipt,
  children,
}: {
  who: string;
  when: string;
  ours?: boolean;
  receipt?: Receipt;
  children: ReactNode;
}) {
  return (
    <div className={ours ? `${styles.bubble} ${styles.ours}` : styles.bubble}>
      <span className={ours ? `${styles.name} ${styles.ourName}` : styles.name}>{who}</span>
      {children}
      {receipt?.kind === "failed" && <p className={styles.undelivered}>{words.replies.undelivered(receipt.why)}</p>}
      <span className={styles.time}>
        {receipt && receipt.kind !== "failed" ? (
          <IconText icon={<Ticks receipt={receipt.kind} />} after>
            <span>{when}</span>
          </IconText>
        ) : (
          when
        )}
      </span>
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
 * A text's words: as one person gets them, or as written, its fields still
 * to fill in, each a chip as a mailing's letter shows it.
 */
export type TextDoc = { content: MailingBlock[] };

/** A line's words as WhatsApp shows them: bold and italic, web addresses links, and nothing for a link's mark, which a text hasn't. */
function Inlines({ content = [] }: { content?: MailingInline[] }) {
  return content.map((node, i) => {
    if (node.type === "hardBreak") return <br key={i} />;
    let words: ReactNode =
      node.type === "field" ? (
        <span className={letter.field}>{FIELD_WORDS[node.attrs.field]}</span>
      ) : (
        <LinkedText text={node.text} />
      );
    for (const mark of node.marks ?? []) {
      if (mark.type === "bold") words = <strong>{words}</strong>;
      if (mark.type === "italic") words = <em>{words}</em>;
    }
    return <Fragment key={i}>{words}</Fragment>;
  });
}

/** A text's lines, lists and quotes, as WhatsApp shows them: a bullet before each item, a bar beside a quote. */
export function TextWords({ words }: { words: TextDoc }) {
  return <div className={styles.words}>{<Blocks blocks={words.content} />}</div>;
}

function Blocks({ blocks }: { blocks: MailingBlock[] }) {
  return blocks.map((block, i) =>
    block.type === "paragraph" ? (
      <p key={i}>
        <Inlines content={block.content} />
      </p>
    ) : block.type === "blockquote" ? (
      <blockquote key={i}>
        <Blocks blocks={block.content} />
      </blockquote>
    ) : (
      <ul key={i}>
        {block.content.map((item, j) => (
          <li key={j}>
            <Blocks blocks={item.content} />
          </li>
        ))}
      </ul>
    ),
  );
}

/**
 * A text as a messaging app shows it, a phone's width: the words in a bubble
 * from us, on the left as it is on their phone, formatted as WhatsApp does,
 * with its footer, the grey line saying how to stop, and the time.
 */
export default function TextBubble({
  from,
  words,
  footer,
  time,
}: {
  from: string;
  words: TextDoc;
  footer: string;
  time: string;
}) {
  return (
    <div className={styles.phone}>
      <ChatWall>
        <div className={`${styles.bubble} ${styles.words}`}>
          <span className={`${styles.name} ${styles.ourName}`}>{from}</span>
          <Blocks blocks={words.content} />
          <span className={styles.footer}>{footer}</span>
          <span className={styles.time}>{time}</span>
        </div>
      </ChatWall>
    </div>
  );
}
