import { Parser } from "htmlparser2";

// An HTML email's text, written as a mailer's plain text writes it, so the
// rest of lib/email-parsing reads it as it reads any plain text: a line for
// each of its lines, a blank line between paragraphs, "- " before a list's
// item, "> " before what a blockquote quotes, a bold piece between
// asterisks, an italic one between underscores, and a link's address in
// angle brackets after its words, when
// its words don't already show where it goes. What the sender hid, and the
// head, its styles and scripts, aren't text.

/** Elements whose content is never text. */
const NOT_TEXT = new Set(["head", "style", "script", "title", "template", "noscript", "object", "svg"]);

/** Elements that start and end a line. */
const BLOCKS = new Set([
  "address",
  "article",
  "aside",
  "center",
  "dd",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "header",
  "hr",
  "main",
  "nav",
  "section",
  "table",
  "tr",
]);

/** Elements with a blank line before and after. */
const PARAGRAPHS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre"]);

/**
 * The marks either side of an element's words, as Gmail's plain text writes
 * them: "*" if it's bold, "_" if it's italic. Its style says, if it sets a
 * weight or a slant, as Google Docs' spans do (and its "<b
 * style="font-weight:normal">" round a whole document undoes); otherwise
 * its tag: b, strong or a heading bold, i or em italic.
 */
function marksOf(name: string, attribs: Record<string, string>): string[] {
  const style = (attribs.style ?? "").toLowerCase();
  const weight = /(?:^|[;\s])font-weight\s*:\s*([a-z0-9]+)/.exec(style)?.[1];
  const slant = /(?:^|[;\s])font-style\s*:\s*([a-z]+)/.exec(style)?.[1];
  const bold = weight ? weight.startsWith("bold") || Number(weight) >= 600 : /^(b|strong|h[1-6])$/.test(name);
  // A slant set on a block, as a mailer sets on a whole quote, is a look, not words stressed.
  const italic =
    slant && !BLOCKS.has(name) && !PARAGRAPHS.has(name) ? slant !== "normal" : name === "i" || name === "em";
  return [...(bold ? ["*"] : []), ...(italic ? ["_"] : [])];
}

/** HTML's own spaces, which only stand between words: a non-breaking space is kept, as a sender typed it. */
const SPACE = /[ \t\r\n\f]+/g;

/** Characters that take up no room, which a mailer adds to keep an empty paragraph or break up an address. */
const INVISIBLE = /[\u200b\u200c\u200d\u2060\ufeff\u00ad]/g;

/** The spaces at a line's ends, non-breaking ones too. */
const EDGE_SPACES = /^[\s\u00a0\u202f]+|[\s\u00a0\u202f]+$/g;

/** Whether an element's style or attributes hide it, as a mailer hides a preview line or Outlook its alternatives. */
function isHidden(attribs: Record<string, string>): boolean {
  const style = (attribs.style ?? "").toLowerCase().replace(/\s+/g, "");
  return (
    "hidden" in attribs ||
    style.includes("display:none") ||
    style.includes("visibility:hidden") ||
    style.includes("mso-hide:all") ||
    /(^|;)(max-)?height:0(px)?(;|$|!)/.test(style)
  );
}

/** The line over a quote, "On … wrote:", in English or Welsh. */
const WROTE = /\b(wrote|ysgrifennodd):\s*$/i;

/** How a quote can start inside it: "On … wrote:", which Apple Mail puts there, or a quoted message's From line. */
const QUOTE_START = /^\s*(On\s[^]{5,300}?\b(wrote|ysgrifennodd):|\*?(From|Oddi wrth):)/i;

/**
 * Whether a blockquote quotes another message, or shows as a quote does: a
 * citation (Apple Mail's, Thunderbird's); Gmail's quote, with its bar down
 * the side, which a reply quotes a question with to answer it under it (and
 * which some put round their signature, so it shows with a bar there too);
 * one under the line Gmail marks as a quote's, in any language, or under
 * "On … wrote:"; or one starting with that or a quoted message's headers.
 * Otherwise it sets words apart: a quotation in a letter, or Gmail's indent.
 * `following` is some of the text it starts with.
 */
function isQuote(
  attribs: Record<string, string>,
  lines: Line[],
  attribution: Line | undefined,
  following: string,
): boolean {
  const over = lines.findLast((line) => line.text.trim());
  return (
    attribs.type?.toLowerCase() === "cite" ||
    (/\bgmail_quote\b/.test(attribs.class ?? "") && /border-left\s*:\s*[^;]*solid/i.test(attribs.style ?? "")) ||
    (over !== undefined && (over === attribution || WROTE.test(over.text.trim()))) ||
    QUOTE_START.test(following)
  );
}

/** The words at the start of some HTML, its tags and entities left as they are but for spaces: enough to see how it starts. */
function opening(html: string): string {
  return html
    .replace(/<(style|head|script)\b[^]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;|\u00a0/gi, " ")
    .replace(/\s+/g, " ");
}

/** Points in one of each CSS unit; a bare number is pixels. */
const POINTS: Record<string, number> = {
  pt: 1,
  px: 0.75,
  "": 0.75,
  cm: 28.35,
  mm: 2.835,
  in: 72,
  pc: 12,
  em: 12,
  rem: 12,
};

/**
 * Whether a margin in CSS is about a line high, so a blank line in text: 9pt
 * or more (a browser's paragraph has 12pt, Word's "auto" spacing 14pt). A
 * heading's 6pt under it, or Word's "0.0001pt", is none. A margin that isn't
 * a length ("auto", a percentage) is a line.
 */
function isLineHigh(value: string): boolean {
  const length = /^(-?[\d.]+)([a-z]*)$/.exec(value);
  if (!length || !(length[2] in POINTS)) return true;
  return parseFloat(length[1]) * POINTS[length[2]] >= 9;
}

/**
 * Whether an element's style gives it space above it or below it: by its
 * margin on that side if it sets one, else by Word's own (mso-margin-top-alt,
 * which Outlook shows, "auto" being a paragraph's usual space), else by the
 * margin's shorthand. Undefined if it sets none.
 */
function marginSpace(attribs: Record<string, string>, side: "top" | "bottom"): boolean | undefined {
  const style = (attribs.style ?? "").toLowerCase();
  const own = new RegExp(`(?:^|[;\\s])margin-${side}\\s*:\\s*([^;!]+)`).exec(style)?.[1];
  const word = new RegExp(`mso-margin-${side}-alt\\s*:\\s*([^;!]+)`).exec(style)?.[1];
  const shorthand = /(?:^|;)\s*margin\s*:\s*([^;!]+)/.exec(style)?.[1].trim().split(/\s+/);
  const margin = own ?? word ?? (shorthand && (side === "top" ? shorthand[0] : (shorthand[2] ?? shorthand[0])));
  return margin === undefined ? undefined : isLineHigh(margin.trim());
}

/**
 * Whether a paragraph or a list has space above it or below it: by its
 * style's margin (marginSpace); otherwise none for Outlook's and Word's
 * (class Mso…) where the message has their styles, which give none, and a
 * line's worth for any other, as a browser gives. Gmail takes those styles
 * out of a message it quotes, so there their paragraphs show spaced.
 */
function hasSpace(attribs: Record<string, string>, side: "top" | "bottom", msoStyled: boolean): boolean {
  return marginSpace(attribs, side) ?? !(msoStyled && /\bmso/i.test(attribs.class ?? ""));
}

/** Whether HTML has Outlook's or Word's styles, which give their paragraphs no margin. */
const hasMsoStyles = (html: string) => /<style[^>]*>[^]*?\.MsoNormal\b[^]*?<\/style>/i.test(html);

/**
 * A link's true address: a scanner's, a search engine's or a mail service's
 * wrapper around it taken off (Outlook's Safe Links, Google's redirect,
 * Proofpoint's, Amazon SES's tracking), so a reader sees where it goes.
 */
function unwrapped(url: URL): URL {
  const host = url.hostname;
  const inner =
    (host.endsWith("safelinks.protection.outlook.com") && url.searchParams.get("url")) ||
    (/(^|\.)google\.[a-z.]+$/.test(host) && url.pathname === "/url" && url.searchParams.get("q")) ||
    (host === "urldefense.com" && /^https:\/\/urldefense\.com\/v3\/__(.+?)__;/.exec(url.href)?.[1]) ||
    (host.endsWith(".awstrack.me") && decodeURIComponent(/^\/L0\/([^/]+)/.exec(url.pathname)?.[1] ?? ""));
  return inner && /^https?:\/\//i.test(inner) && URL.canParse(inner) ? unwrapped(new URL(inner)) : url;
}

/**
 * Whether an address tells a reader nothing: a mail service's tracking link,
 * which hides where it goes, or the map search Gmail puts on a street address.
 */
function tellsNothing(url: URL): boolean {
  const host = url.hostname;
  return (
    host.endsWith(".ct.sendgrid.net") ||
    host.endsWith(".click.mailersend.net") ||
    host.endsWith(".list-manage.com") ||
    host === "mandrillapp.com" ||
    host.endsWith(".hubspotlinks.com") ||
    host.endsWith(".onelink.me") ||
    (/^(www\.)?google\.[a-z.]+$/.test(host) && url.pathname.startsWith("/maps/search/"))
  );
}

/** A link's address as a reader can use it, unwrapped; none for one that isn't to a web page, or that tells nothing. */
export function linkAddress(href: string): string | undefined {
  if (!/^https?:\/\//i.test(href.trim()) || !URL.canParse(href.trim())) return undefined;
  let url: URL;
  try {
    url = unwrapped(new URL(href.trim()));
  } catch {
    // A wrapper whose address is badly encoded hides where it goes as a tracker does.
    return undefined;
  }
  return /^https?:$/.test(url.protocol) && !tellsNothing(url) ? url.href : undefined;
}

/** An address as a reader would type it: without its "https://", "www." or a closing "/". */
const typed = (address: string) =>
  address
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, "")
    .replace(/\/$/, "");

/**
 * Whether a link's words are a web address already, which a reader sees and
 * the page links, or its own address without the "https://" ("example.org/b"
 * for https://www.example.org/b/), which says where it goes. Another
 * address without its "https://" the page can't link, so it gets its
 * address after it, as Gmail's plain text writes it.
 */
function showsAddress(words: string, address: string): boolean {
  return /^https?:\/\/\S+$/i.test(words) || typed(words) === typed(address);
}

/**
 * A line of the text being written: its words, how deep in quotes it is,
 * and what comes before its words, a list's mark. Or a rule, `<hr>`.
 */
type Line = { text: string; depth: number; mark: string; rule?: boolean };

/**
 * The line Outlook's plain text writes for the rule over the headers of the
 * message it answers or forwards, which says where that message starts.
 */
const OUTLOOK_RULE = "_".repeat(32);

/** A quoted message's From line, as Outlook writes it in English or Welsh, maybe in bold. */
const QUOTED_FROM = /^\*?(From|Oddi wrth):/i;

/** A bullet as Word writes it in a symbol font: Symbol's dot, Courier's "o", Wingdings' square, arrow or tick. */
const BULLETS = /^[·•o§▪Øü]$/;

/** A line all in bold that doesn't end a sentence: a heading. */
const HEADING = /^\*[^*]+[^*.,:;]\*$/;

/** A line ending a sentence, as the paragraph before a heading does: a signature's "Kind regards," doesn't. */
const SENTENCE_END = /[.!?)]$/;

/** A list being written: numbered or not, and its next number. */
type List = { ordered: boolean; next: number };

/** An open element: whether it hid its content, and where its words started, for a link or a bold piece. */
type Open = {
  hides: boolean;
  /** Gmail's line over a quote, "On … wrote:" in the writer's language. */
  attribution?: boolean;
  start?: { line: Line; at: number };
  href?: string;
  /** Word's list mark, as Word writes it or as it's left once Gmail has quoted it. */
  marker?: "word" | "symbol";
  /** A paragraph with no space under it. */
  tight?: boolean;
  /** A blockquote that quotes, rather than indents. */
  quote?: boolean;
  /** A block whose style gives it space under it. */
  spaced?: boolean;
  /** A quote with no margin under it, which one straight after with none over it joins. */
  joins?: boolean;
  /** Its styles' marks, each with where its words start if it's the outermost in that style. */
  styled: { mark: string; start?: MarkStart }[];
};

/** Where a piece in a style starts: a place on a line, or the start of the line at `index`, not yet written. */
type MarkStart = { line: Line; at: number } | { index: number };

/** An HTML part's text, as a mailer's plain text would write it. */
export function htmlText(html: string): string {
  const lines: Line[] = [];
  const stack: Open[] = [];
  const lists: List[] = [];
  let line: Line | undefined;
  let hidden = 0;
  let quoteDepth = 0;
  /** How many bold or italic elements are open, by their mark: only the outermost marks its words. */
  const markDepth: Record<string, number> = { "*": 0, _: 0 };
  /** The last piece marked in each style, where its first mark is and where it ends, so one right after it joins it. */
  const lastRun: Record<string, { line: Line; start: number; end: number } | undefined> = {};
  let preDepth = 0;
  const msoStyled = hasMsoStyles(html);
  /** The last quote to close: how many lines there were then, and whether one straight after joins it. */
  let quoteEnd: { at: number; joins: boolean } | undefined;
  let blankWanted = false;
  /** The shallowest quote since the last line, so a blank line between two quotes is outside both. */
  let gapDepth = 0;
  /** The last line Gmail marked as a quote's. */
  let attribution: Line | undefined;
  let markWanted = "";

  /** Ends the line being written, if there is one. */
  const endLine = () => {
    line = undefined;
  };
  /** Ends the line being written, and asks for a blank line before the next words. */
  const endParagraph = () => {
    endLine();
    if (lines.length) blankWanted = true;
  };
  /** The line to write on: the one being written, or a new one, a blank line before it if one was asked for. */
  const current = (): Line => {
    if (line) return line;
    const last = lines.at(-1);
    if (blankWanted && last?.text.trim()) lines.push({ text: "", depth: Math.min(last.depth, gapDepth), mark: "" });
    blankWanted = false;
    line = { text: "", depth: quoteDepth, mark: markWanted };
    gapDepth = quoteDepth;
    markWanted = "";
    lines.push(line);
    return line;
  };
  const write = (words: string) => {
    if (hidden) return;
    const plain = words.replace(INVISIBLE, "");
    if (preDepth) {
      plain.split(/\r?\n/).forEach((piece, i) => {
        if (i) endLine();
        current().text += piece;
      });
      return;
    }
    const spaced = plain.replace(SPACE, " ");
    // Only HTML's own spaces start no line; a non-breaking space alone is how Outlook writes a blank line.
    if (!line && !spaced.replace(/ /g, "")) return;
    const target = current();
    target.text += target.text === "" || target.text.endsWith(" ") ? spaced.trimStart() : spaced;
  };
  /**
   * Where a piece in a style starts: where the line being written is up to,
   * or, with none, the next line to be written, so a block that starts in a
   * style, as a heading does, writes no line of its own. Right after a
   * piece in the same style, as Outlook writes an address in several, it
   * starts where that one did, its marks taken off: one piece.
   */
  const from = (mark: string): MarkStart => {
    if (!line) return { index: lines.length };
    const last = lastRun[mark];
    if (last?.line === line && last.end === line.text.length) {
      line.text = line.text.slice(0, last.start) + line.text.slice(last.start + 1, -1);
      return { line, at: last.start };
    }
    return { line, at: line.text.length };
  };
  /**
   * Marks the words written since `start` with `mark` either side, outside
   * their spaces, on each line they run over, so a mark never pairs across
   * lines; not on a line whose words have the mark in them already.
   */
  const marked = (start: MarkStart, mark: string) => {
    const first = "index" in start ? start.index : lines.indexOf(start.line);
    const last = lines.indexOf(line ?? lines.at(-1)!);
    for (let i = first; i <= last; i++) {
      const written = lines[i];
      const from = i === first && "at" in start ? start.at : 0;
      const piece = written.text.slice(from);
      // Punctuation it starts with stays outside its marks, which can't pair after it.
      const lead = piece.match(/^[\s.,;:!?)\]]*/)![0];
      const words = piece.slice(lead.length).trim();
      // Not on words with a mark in them already, nor italic round bold, which mailParts can't read.
      if (!words || words.includes(mark) || (mark === "_" && words.includes("*"))) continue;
      const head = written.text.slice(0, from) + lead;
      const after = piece.match(/\s*$/)![0];
      written.text = `${head}${mark}${words}${mark}${after}`;
      if (i === last && !after) lastRun[mark] = { line: written, start: head.length, end: written.text.length };
    }
  };

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const open: Open = { hides: NOT_TEXT.has(name) || isHidden(attribs), styled: [] };
        stack.push(open);
        if (open.hides) hidden++;
        if (hidden) return;
        open.attribution = /gmail_attr/.test(attribs.class ?? "");
        if (name === "br") {
          if (line) endLine();
          else current();
          endLine();
        } else if (name === "hr") {
          endLine();
          current().rule = true;
          endLine();
        } else if (BLOCKS.has(name)) {
          // A block has no space round it unless its style gives it some, as Outlook on the web's paragraphs do.
          open.spaced = marginSpace(attribs, "bottom") === true;
          if (marginSpace(attribs, "top")) endParagraph();
          else endLine();
        } else if (PARAGRAPHS.has(name)) {
          const following =
            name === "blockquote" ? opening(html.slice(parser.endIndex + 1, parser.endIndex + 2000)) : "";
          open.quote = name === "blockquote" && isQuote(attribs, lines, attribution, following);
          // A paragraph by its margins; a blockquote that only indents, as Gmail's signature does, by any it sets.
          const side = (side: "top" | "bottom") =>
            name === "p"
              ? hasSpace(attribs, side, msoStyled)
              : open.quote || name !== "blockquote" || marginSpace(attribs, side) !== false;
          open.tight = !side("bottom");
          if (open.quote) open.joins = marginSpace(attribs, "bottom") === false;
          if (open.quote && quoteEnd?.at === lines.length && quoteEnd.joins && marginSpace(attribs, "top") === false) {
            // Straight after a quote, neither with a margin between, as a signature's lines in quotes are: one quote.
            blankWanted = false;
            endLine();
          } else if (side("top")) endParagraph();
          else endLine();
          if (open.quote) quoteDepth++;
          if (name === "pre") preDepth++;
        } else if (name === "ul" || name === "ol") {
          // A list has a blank line above it where a browser gives it space, unless it's in another.
          if (!lists.length && hasSpace(attribs, "top", msoStyled)) endParagraph();
          else endLine();
          lists.push({ ordered: name === "ol", next: Number(attribs.start) || 1 });
        } else if (name === "li") {
          endLine();
          const list = lists.at(-1);
          const indent = "  ".repeat(Math.max(0, lists.length - 1));
          markWanted = `${indent}${list?.ordered ? `${list.next++}.` : "-"} `;
        } else if (name === "td" || name === "th") {
          if (line?.text.trim() && !line.text.endsWith(" ")) line.text += " ";
        } else if (name === "a" && attribs.href) {
          open.href = attribs.href;
          open.start = { line: current(), at: current().text.length };
        } else if (/mso-list:\s*ignore/i.test(attribs.style ?? "")) {
          // Word's list mark, a symbol-font bullet or a number, written as text before the item's words.
          open.marker = "word";
          open.start = { line: current(), at: current().text.length };
        } else if (/font-family:\s*"?(symbol|wingdings)/i.test(attribs.style ?? "") && !line?.text.trim()) {
          // The same mark once Gmail has quoted it, its mso-list taken off: a bullet in a symbol font starting a line.
          open.marker = "symbol";
          open.start = { line: current(), at: current().text.length };
        }
        // Only the outermost element in a style marks its words.
        open.styled = marksOf(name, attribs).map((mark) => ({
          mark,
          start: markDepth[mark]++ ? undefined : from(mark),
        }));
      },
      ontext(text) {
        write(text);
      },
      onclosetag(name) {
        // The parser closes only what it opened, each in turn.
        const open = stack.pop()!;
        const wasHidden = hidden > 0;
        if (open.hides) hidden--;
        if (wasHidden) return;
        if (open.attribution) attribution = lines.findLast((written) => written.text.trim());
        // Italic marks go on inside bold ones, "*_both_*", as mailParts reads them.
        for (const { mark, start } of open.styled.toReversed()) {
          markDepth[mark]--;
          if (start) marked(start, mark);
        }
        if (name === "a" && open.start) {
          const { line: at, at: from } = open.start;
          // Its words without a bold or italic piece's marks, which may have come on round them.
          const words = at.text
            .slice(from)
            .trim()
            .replace(/^[*_]+|[*_]+$/g, "");
          const address = linkAddress(open.href!);
          if (at === line && words && address && !showsAddress(words, address)) at.text += ` <${address}>`;
        } else if (open.marker && open.start) {
          const { line: at, at: from } = open.start;
          const mark = at.text.slice(from).replace(/[\s\u00a0]+/g, "");
          const numbered = /^(\d+|[a-z]|[ivx]+)[.)]$/i.test(mark);
          // Words in a symbol font that aren't a bullet are words.
          if (open.marker === "word" || numbered || BULLETS.test(mark))
            at.text = at.text.slice(0, from) + (numbered ? `${mark} ` : "- ");
        } else if (name === "br") {
          // A void element: its line ended when it opened.
        } else if (BLOCKS.has(name)) {
          if (open.spaced) endParagraph();
          else endLine();
        } else if (PARAGRAPHS.has(name)) {
          if (open.quote) {
            gapDepth = Math.min(gapDepth, --quoteDepth);
            quoteEnd = { at: lines.length, joins: open.joins! };
          }
          if (name === "pre") preDepth--;
          if (open.tight) endLine();
          else endParagraph();
        } else if (name === "ul" || name === "ol") {
          lists.pop();
          if (lists.length) endLine();
          else endParagraph();
        } else if (name === "li") {
          endLine();
        }
      },
    },
    { decodeEntities: true, lowerCaseTags: true, lowerCaseAttributeNames: true, recognizeSelfClosing: true },
  );
  parser.write(html);
  parser.end();
  return render(lines);
}

/**
 * The lines as text: each with its quote marks and list mark, no spaces at
 * its ends, and at most one blank line in a row. A rule is Outlook's line
 * over a quoted message's headers, or nothing.
 */
function render(lines: Line[]): string {
  const out: string[] = [];
  for (const [i, { text, depth, mark, rule }] of lines.entries()) {
    if (rule) {
      const next = lines.slice(i + 1).find((later) => later.rule || later.text.replace(EDGE_SPACES, ""));
      if (next && !next.rule && QUOTED_FROM.test(next.text.replace(EDGE_SPACES, "")))
        out.push(`${"> ".repeat(depth)}${OUTLOOK_RULE}`);
      continue;
    }
    const words = text.replace(EDGE_SPACES, "");
    const quote = "> ".repeat(depth);
    const written = words || mark ? `${quote}${mark}${words}` : quote;
    const blank = !words && !mark;
    if (blank && (!out.length || !out.at(-1)!.replace(/[>\s]/g, ""))) continue;
    // A heading, a line all bold, stands apart from the paragraph it follows, however its margins are set.
    if (!mark && HEADING.test(words) && SENTENCE_END.test(out.at(-1) ?? "")) out.push(quote.trimEnd());
    out.push(written.trimEnd());
  }
  while (out.length && !out.at(-1)!.replace(/[>\s]/g, "")) out.pop();
  return out.join("\n");
}
