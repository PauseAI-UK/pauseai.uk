import { mailBlocks, mailParts, type MailBlock, type MailList, type MailPart } from "@/lib/email-parsing/mail-text";
import ExternalLink from "../ui/ExternalLink";
import styles from "./ThreadText.module.css";

/** Pieces of an email's text, each link leaving the site and each bold piece bold. */
function Parts({ parts }: { parts: MailPart[] }) {
  return parts.map((part, i) => {
    if ("link" in part) {
      return (
        <ExternalLink key={i} href={part.link}>
          {part.link}
        </ExternalLink>
      );
    }
    if ("bold" in part) {
      return (
        <strong key={i}>
          <Parts parts={part.bold} />
        </strong>
      );
    }
    return part.text;
  });
}

/** A list, bulleted or numbered, with the lists nested in its items. */
function List({ list }: { list: MailList }) {
  const items = list.items.map((item, i) => (
    <li key={i}>
      <Parts parts={mailParts(item.text)} />
      {item.nested.map((nested, j) => (
        <List key={j} list={nested} />
      ))}
    </li>
  ));
  return list.ordered ? (
    <ol className={styles.list} start={list.start}>
      {items}
    </ol>
  ) : (
    <ul className={styles.list}>{items}</ul>
  );
}

/**
 * Blocks of an email's text. Lines before a list, a quote or a rule end with
 * a line break, so the element around them, which keeps their lines, shows a
 * blank line between only where the text has one.
 */
function Blocks({ blocks }: { blocks: MailBlock[] }) {
  return blocks.map((block, i) => {
    if ("list" in block) return <List key={i} list={block.list} />;
    if ("quote" in block) {
      return (
        <blockquote key={i} className={styles.quote}>
          <Blocks blocks={block.quote} />
        </blockquote>
      );
    }
    if ("rule" in block) return <hr key={i} className={styles.rule} />;
    return <Parts key={i} parts={mailParts(i < blocks.length - 1 ? `${block.text}\n` : block.text)} />;
  });
}

/** An email's plain text in a thread, with its links, bold, lists, quotes and rules (lib/email-parsing/mail-text.ts). The element around it keeps its lines. */
export default function ThreadText({ text }: { text: string }) {
  return <Blocks blocks={mailBlocks(text)} />;
}
