import { Fragment, type ReactNode } from "react";
import { FIELD_WORDS } from "@/lib/broadcasts/broadcasts";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import type { LinkCard } from "@/lib/broadcasts/link-card";
import type { TextPlace } from "@/lib/broadcasts/text-parts";
import type { Receipt } from "@/lib/broadcasts/receipts";
import type { MailingBlock, MailingInline } from "@/lib/mailings/doc";
import IconText from "../ui/IconText";
import letter from "../mailings/MailingLetter.module.css";
import PlaceMap from "./PlaceMap";
import styles from "./Broadcasts.module.css";
import TextFold from "./TextFold";

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
 * words, that WhatsApp couldn't deliver it. Theirs can have something
 * `beside` it, in the space to its right, and our emoji on it (`badge`), at
 * its foot, as WhatsApp shows a reaction. Ours can have its text's buttons
 * (`buttons`), under it and as wide, as WhatsApp shows them.
 */
export function ChatBubble({
  who,
  when,
  ours = false,
  receipt,
  beside,
  badge,
  buttons = [],
  children,
}: {
  who: string;
  when: ReactNode;
  ours?: boolean;
  receipt?: Receipt;
  beside?: ReactNode;
  badge?: string;
  buttons?: string[];
  children: ReactNode;
}) {
  const classes = [styles.bubble, ours && styles.ours, badge && styles.badged].filter(Boolean).join(" ");
  const bubble = (
    <div className={classes}>
      {beside && <span className={styles.beside}>{beside}</span>}
      {badge && (
        <span className={styles.badge} aria-hidden="true">
          {badge}
        </span>
      )}
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
  if (!buttons.length) return bubble;
  return (
    <div className={styles.withButtons}>
      {bubble}
      <BubbleButtons buttons={buttons} />
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

/** The card WhatsApp shows at the top of a text for its link: the page's title, a line of its description, its site. */
function LinkCardView({ card }: { card: LinkCard }) {
  return (
    <div className={styles.linkCard}>
      <strong className={styles.cardTitle}>{card.title}</strong>
      <span className={styles.cardLine}>{card.description}</span>
      <span className={styles.cardLine}>{card.site}</span>
    </div>
  );
}

/**
 * A text's map, as WhatsApp shows one at its top: a map with a pin, then
 * the place's name and address. A drawing of a map, not the place's own,
 * as the preview fetches no map; the place's own name and address are
 * under it.
 */
function MapTop({ place, realMap }: { place: TextPlace; realMap?: boolean }) {
  return (
    <div className={styles.mapTop}>
      <PlaceMap place={place} real={realMap} />
      <span className={styles.mapPlace}>
        <strong>{place.name}</strong>
        <span>{place.address}</span>
      </span>
    </div>
  );
}

/** A text's top: its picture, or its map, OpenStreetMap's where `realMap` says (PlaceMap), or else its link's card. */
export function BubbleTop({
  place,
  picture,
  card,
  realMap,
}: {
  place?: TextPlace | null;
  picture?: string | null;
  card?: LinkCard | null;
  realMap?: boolean;
}) {
  // eslint-disable-next-line @next/next/no-img-element -- a staff upload, or an example's data: address, shown as sent
  if (picture) return <img className={styles.pictureTop} src={picture} alt="" />;
  if (place) return <MapTop place={place} realMap={realMap} />;
  return card ? <LinkCardView card={card} /> : null;
}

/** A text's buttons, each its words, under its bubble, as WhatsApp shows them. */
function BubbleButtons({ buttons }: { buttons: string[] }) {
  if (!buttons.length) return null;
  return (
    <ul className={styles.replyButtons}>
      {buttons.map((words, i) => (
        <li key={i}>{words}</li>
      ))}
    </ul>
  );
}

/**
 * A text as a messaging app shows it, a phone's width: the words in a bubble
 * from us, on the left as it is on their phone, formatted as WhatsApp does,
 * under its picture or map, if it has one, or the card for their link if there is
 * one, folded at five lines, with its footer, the grey line saying how to
 * stop, and the time; under it, its reply buttons. No name on it,
 * as WhatsApp puts none on a bubble in a chat with one business.
 */
export default function TextBubble({
  words,
  card,
  place,
  picture,
  buttons = [],
  footer,
  time,
  realMap,
}: {
  words: TextDoc;
  card?: LinkCard | null;
  /** The place its map shows, at its top in place of a link's card. */
  place?: TextPlace | null;
  /** Where the picture at its top is, in place of a link's card. */
  picture?: string | null;
  /** Its reply buttons' words, each a button under it, as WhatsApp shows them. */
  buttons?: string[];
  footer: string;
  time: string;
  /** Whether its map is OpenStreetMap's, for a page drawn on the server (PlaceMap); else as the writer says. */
  realMap?: boolean;
}) {
  return (
    <div className={styles.phone}>
      <ChatWall>
        <div className={`${styles.bubble} ${styles.phoneBubble}`}>
          <BubbleTop place={place} picture={picture} card={card} realMap={realMap} />
          {/* Folded again once the words change, so the preview shows where the fold falls in what's just been written. */}
          <TextFold key={JSON.stringify(words.content)}>
            <Blocks blocks={words.content} />
          </TextFold>
          <span className={styles.footer}>{footer}</span>
          <span className={styles.time}>{time}</span>
        </div>
        <BubbleButtons buttons={buttons} />
      </ChatWall>
    </div>
  );
}
