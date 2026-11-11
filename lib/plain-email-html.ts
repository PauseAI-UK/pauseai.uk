import { mailParts, type MailPart } from "@/lib/email-parsing/mail-text";

// An email written as plain text, as HTML too. A mail app shows a text-only
// email in whatever it keeps for plain text, often a fixed-width font in
// lines broken at a set width; one with HTML it shows in its own font,
// wrapped to its window. So the same words go as HTML beside the text
// (send() in lib/server/email.ts), in paragraphs with nothing else set.

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A space that HTML keeps, where it would run several spaces together or drop them from a line's start. */
const KEPT_SPACE = " ";

/**
 * A paragraph's text with its layout kept: the spaces a line starts with,
 * and all but the last of several together, so the line can still break
 * there. A tab is four spaces.
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

/**
 * A plain-text email's words as HTML: a paragraph for each run of lines
 * with a blank line after it, a line break where a line ends, each web
 * address a link to itself, and words between asterisks bold, as
 * mailParts() reads them. Everything else is escaped.
 */
export function plainAsHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n(?:[ \t]*\n)+/)
    .map((paragraph) => paragraph.replace(/^\n+|\s+$/g, ""))
    .filter(Boolean)
    .map((paragraph) => `<p>${mailParts(spaced(paragraph)).map(partHtml).join("")}</p>`)
    .join("\n");
}
