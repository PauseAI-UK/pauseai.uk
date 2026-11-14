import { mailParts, type MailPart } from "@/lib/email-parsing/mail-text";

// An email written as plain text, as HTML too. A mail app shows a text-only
// email in whatever it keeps for plain text, often a fixed-width font in
// lines broken at a set width; one with HTML it shows in its own font,
// wrapped to its window. So the same words go as HTML beside the text
// (sendWith() in lib/server/email.server.ts), in paragraphs and bulleted lists with
// nothing else set.

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A no-break space, which HTML keeps where it would run several spaces together or drop them from a line's start. */
const KEPT_SPACE = String.fromCharCode(0xa0);

/**
 * Text with its layout kept: the spaces a line starts with, and all but the
 * last of several together, so the line can still break there. A tab is
 * four spaces.
 */
function spaced(text: string): string {
  return text
    .replace(/\t/g, "    ")
    .replace(/^ +/gm, (spaces) => KEPT_SPACE.repeat(spaces.length))
    .replace(/ {2,}/g, (spaces) => `${KEPT_SPACE.repeat(spaces.length - 1)} `);
}

function partHtml(part: MailPart): string {
  if ("link" in part) return `<a href="${escape(part.link)}">${escape(part.link)}</a>`;
  if ("bold" in part) return `<strong>${part.bold.map(partHtml).join("")}</strong>`;
  return escape(part.text).replace(/\n/g, "<br>");
}

/** Lines of text as HTML, without what holds them: a break where each ends, links and bold. */
function inlineHtml(text: string): string {
  return mailParts(spaced(text)).map(partHtml).join("");
}

/** Some of a block's lines together: the items of a list, each the text after its "- ", or lines of words. */
type Run = { items: string[] } | { lines: string[] };

/**
 * A block's lines in runs: those that start "- " together are a list's
 * items, with a line set in under an item part of that item; any others
 * together are words. So a line that leads into a list, with no blank line
 * between, is words above it.
 */
function runs(block: string): Run[] {
  const all: Run[] = [];
  for (const line of block.split("\n")) {
    const last = all.at(-1);
    const list = last && "items" in last ? last.items : undefined;
    if (line.startsWith("- ")) {
      if (list) list.push(line.slice(2));
      else all.push({ items: [line.slice(2)] });
    } else if (list && /^[ \t]/.test(line)) {
      list[list.length - 1] += `\n${line.trim()}`;
    } else if (last && "lines" in last) {
      last.lines.push(line);
    } else {
      all.push({ lines: [line] });
    }
  }
  return all;
}

function runHtml(run: Run): string {
  return "items" in run
    ? `<ul>${run.items.map((item) => `<li>${inlineHtml(item)}</li>`).join("")}</ul>`
    : `<p>${inlineHtml(run.lines.join("\n"))}</p>`;
}

/**
 * A plain-text email's words as HTML. Each block of lines with a blank line
 * after it is a paragraph, with a line break where a line ends; lines that
 * start "- " are a bulleted list. Each web address is a link to itself, and
 * words between asterisks are bold, as mailParts() reads them. Everything
 * else is escaped.
 */
export function plainAsHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n(?:[ \t]*\n)+/)
    .map((block) => block.replace(/^\n+|\s+$/g, ""))
    .filter(Boolean)
    .flatMap((block) => runs(block).map(runHtml))
    .join("\n");
}
