import { Parser } from "htmlparser2";

// An HTML email's text, written as a mailer's plain text writes it, so the
// rest of lib/email-parsing reads it as it reads any plain text: a line for
// each of its lines, a blank line between paragraphs, "- " before a list's
// item, "> " before what a blockquote quotes, a bold piece between
// asterisks, and a link's address in angle brackets after its words, when
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

/** Elements that make their words bold. */
const BOLD = new Set(["b", "strong"]);

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
 * Whether a blockquote quotes another message: a citation (Apple Mail's,
 * Thunderbird's), or one under the line Gmail marks as a quote's, in any
 * language, or under "On … wrote:", or starting with that or a quoted
 * message's headers. Otherwise it sets words apart, however it's classed or
 * styled: a quotation in a letter, a signature, or Gmail's indent.
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

/** Whether a length in CSS is nothing, or as good as: "0", "0cm", Word's "0.0001pt". */
function isNoLength(value: string): boolean {
  const length = parseFloat(value);
  return Number.isFinite(length) && Math.abs(length) < 0.01;
}

/**
 * Whether a paragraph has space above it or below it: by its style's margin
 * on that side if it sets one; otherwise none for Outlook's and Word's (class
 * Mso…), whose own styles give none, and a line's worth for any other.
 */
function hasSpace(attribs: Record<string, string>, side: "top" | "bottom"): boolean {
  const style = (attribs.style ?? "").toLowerCase();
  const own = new RegExp(`margin-${side}\\s*:\\s*([^;!]+)`).exec(style)?.[1];
  const shorthand = /(?:^|;)\s*margin\s*:\s*([^;!]+)/.exec(style)?.[1].trim().split(/\s+/);
  const margin = own ?? (shorthand && (side === "top" ? shorthand[0] : (shorthand[2] ?? shorthand[0])));
  if (margin !== undefined) return !isNoLength(margin.trim());
  return !/\bmso/i.test(attribs.class ?? "");
}

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

/**
 * Whether a link's words are a web address already, which a reader sees and
 * the page links. One without its "https://", such as "example.org", the page
 * can't link, so it gets its address after it, as Gmail's plain text writes it.
 */
function showsAddress(words: string): boolean {
  return /^https?:\/\/\S+$/i.test(words);
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

/** A list being written: numbered or not, and its next number. */
type List = { ordered: boolean; next: number };

/** An open element: whether it hid its content, and where its words started, for a link or a bold piece. */
type Open = {
  hides: boolean;
  /** Gmail's line over a quote, "On … wrote:" in the writer's language. */
  attribution?: boolean;
  start?: { line: Line; at: number };
  href?: string;
  /** Word's list mark. */
  marker?: boolean;
  /** A paragraph with no space under it. */
  tight?: boolean;
  /** A blockquote that quotes, rather than indents. */
  quote?: boolean;
};

/** An HTML part's text, as a mailer's plain text would write it. */
export function htmlText(html: string): string {
  const lines: Line[] = [];
  const stack: Open[] = [];
  const lists: List[] = [];
  let line: Line | undefined;
  let hidden = 0;
  let quoteDepth = 0;
  let boldDepth = 0;
  let preDepth = 0;
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

  const parser = new Parser(
    {
      onopentag(name, attribs) {
        const open: Open = { hides: NOT_TEXT.has(name) || isHidden(attribs) };
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
          endLine();
        } else if (PARAGRAPHS.has(name)) {
          const paragraph = name === "p";
          open.tight = paragraph && !hasSpace(attribs, "bottom");
          if (paragraph && !hasSpace(attribs, "top")) endLine();
          else endParagraph();
          const following =
            name === "blockquote" ? opening(html.slice(parser.endIndex + 1, parser.endIndex + 2000)) : "";
          if (name === "blockquote" && isQuote(attribs, lines, attribution, following)) {
            open.quote = true;
            quoteDepth++;
          }
          if (name === "pre") preDepth++;
        } else if (name === "ul" || name === "ol") {
          endLine();
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
        } else if (BOLD.has(name)) {
          if (boldDepth++ === 0) open.start = { line: current(), at: current().text.length };
        } else if (/mso-list:\s*ignore/i.test(attribs.style ?? "")) {
          // Word's list mark, a symbol-font bullet or a number, written as text before the item's words.
          open.marker = true;
          open.start = { line: current(), at: current().text.length };
        }
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
        if (name === "a" && open.start) {
          const { line: at, at: from } = open.start;
          const words = at.text.slice(from).trim();
          const address = linkAddress(open.href!);
          if (at === line && words && address && !showsAddress(words)) at.text += ` <${address}>`;
        } else if (BOLD.has(name)) {
          boldDepth--;
          const start = open.start;
          if (start && start.line === line) {
            const piece = start.line.text.slice(start.at);
            const words = piece.trim();
            if (words && !words.includes("*")) {
              const before = piece.match(/^\s*/)![0];
              const after = piece.match(/\s*$/)![0];
              start.line.text = `${start.line.text.slice(0, start.at)}${before}*${words}*${after}`;
            }
          }
        } else if (open.marker && open.start) {
          const { line: at, at: from } = open.start;
          const mark = at.text.slice(from).replace(/[\s\u00a0]+/g, "");
          at.text = at.text.slice(0, from) + (/^(\d+|[a-z]|[ivx]+)[.)]$/i.test(mark) ? `${mark} ` : "- ");
        } else if (name === "br") {
          // A void element: its line ended when it opened.
        } else if (BLOCKS.has(name)) {
          endLine();
        } else if (PARAGRAPHS.has(name)) {
          if (open.quote) gapDepth = Math.min(gapDepth, --quoteDepth);
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
    out.push(written.trimEnd());
  }
  while (out.length && !out.at(-1)!.replace(/[>\s]/g, "")) out.pop();
  return out.join("\n");
}
