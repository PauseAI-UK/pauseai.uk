// A plain-text email's marks, as Gmail's plain text writes them: a link as
// its address, often twice ("https://a.org <https://a.org>"), bold words
// between asterisks, a list's items after "- " or "1. ", indented when
// nested, what a message quotes after "> ", and Outlook's rule over the
// headers of the message it answers. ThreadText shows them.

/** A piece of an email's text: words, a link, or bold pieces. */
export type MailPart = { text: string } | { link: string } | { bold: MailPart[] };

/** An address, up to a space or an angle bracket. */
const URL = /https?:\/\/[^\s<>"]+/g;

/** What can follow an address without being part of it. */
const AFTER_URL = /[.,;:!?)\]'*]+$/;

/**
 * Asterisks around words, starting and ending at a word's edge, so "2 * 3" and
 * a "* " list aren't bold; within a paragraph, so a stray one pairs with nothing
 * further down.
 */
const BOLD = /(^|[\s(])\*(?=\S)((?:(?!\n\s*\n)[^*])*?[^\s*])\*(?=$|[\s).,;:!?])/gm;

/** The links in `text`, an address given twice being one link. */
function linked(text: string): MailPart[] {
  const parts: MailPart[] = [];
  const add = (words: string) => {
    if (words) parts.push({ text: words });
  };
  let from = 0;
  for (const match of text.matchAll(URL)) {
    if (match.index < from) continue;
    const link = match[0].replace(AFTER_URL, "");
    add(text.slice(from, match.index));
    parts.push({ link });
    from = match.index + link.length;
    const again = `<${link}>`;
    const gap = text.slice(from).match(/^\s*/)![0];
    if (text.startsWith(again, from + gap.length)) from += gap.length + again.length;
  }
  add(text.slice(from));
  return parts;
}

/** An email's text, in pieces. */
export function mailParts(text: string): MailPart[] {
  const parts: MailPart[] = [];
  let from = 0;
  for (const match of text.matchAll(BOLD)) {
    const start = match.index + match[1].length;
    parts.push(...linked(text.slice(from, start)), { bold: linked(match[2]) });
    from = match.index + match[0].length;
  }
  parts.push(...linked(text.slice(from)));
  return parts;
}

/** A list: bulleted or numbered from `start`, each item's words and the lists nested under it. */
export type MailList = { ordered: boolean; start: number; items: { text: string; nested: MailList[] }[] };

/** A block of an email's text: lines as they are, a list, what it quotes, or a rule. */
export type MailBlock = { text: string } | { list: MailList } | { quote: MailBlock[] } | { rule: true };

/** A list's item: its indent, then "-", "*" or "•", or a number and "." or ")", then its words. */
const ITEM = /^( *)(?:[-*•]|(\d{1,3})[.)]) +(\S.*)$/;

/** A quoted line, "> " before it, or ">" alone for a blank one. */
const QUOTED = /^>( |$)/;

/** Outlook's rule over the headers of the message a reply quotes. */
const RULE = /^_{20,}$/;

type Item = { indent: number; ordered: boolean; number: number; text: string };

/** Items in a row as lists: one per run of the same kind at the shallowest indent, deeper ones nested in the item above. */
function listsOf(items: Item[]): MailList[] {
  const base = Math.min(...items.map((item) => item.indent));
  const lists: MailList[] = [];
  let deeper: Item[] = [];
  const nest = () => {
    if (deeper.length)
      lists
        .at(-1)!
        .items.at(-1)!
        .nested.push(...listsOf(deeper));
    deeper = [];
  };
  for (const item of items) {
    if (item.indent > base && lists.length) {
      deeper.push(item);
      continue;
    }
    nest();
    if (lists.at(-1)?.ordered !== item.ordered) lists.push({ ordered: item.ordered, start: item.number, items: [] });
    lists.at(-1)!.items.push({ text: item.text, nested: [] });
  }
  nest();
  return lists;
}

/** An email's text in blocks: its lists, quotes and rules apart from the lines around them. */
export function mailBlocks(text: string): MailBlock[] {
  const lines = text.split("\n");
  const blocks: MailBlock[] = [];
  let plain: string[] = [];
  const flush = () => {
    if (plain.length) blocks.push({ text: plain.join("\n") });
    plain = [];
  };
  for (let i = 0; i < lines.length;) {
    if (QUOTED.test(lines[i])) {
      const quoted: string[] = [];
      while (i < lines.length && QUOTED.test(lines[i])) quoted.push(lines[i++].replace(QUOTED, ""));
      flush();
      blocks.push({ quote: mailBlocks(quoted.join("\n")) });
    } else if (RULE.test(lines[i])) {
      i++;
      flush();
      blocks.push({ rule: true });
    } else if (ITEM.test(lines[i])) {
      const items: Item[] = [];
      for (let match; i < lines.length && (match = ITEM.exec(lines[i])); i++) {
        const [, indent, number, words] = match;
        items.push({ indent: indent.length, ordered: number !== undefined, number: Number(number ?? 1), text: words });
      }
      flush();
      blocks.push(...listsOf(items).map((list) => ({ list })));
    } else {
      plain.push(lines[i++]);
    }
  }
  flush();
  return blocks;
}
