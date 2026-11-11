// What a message says, apart from what's only in the way: the earlier mail it
// quotes, and the signature and footer its writer, mailer or office adds. The
// thread on a letter's page shows every message in turn, so these are folded
// away, not lost. A signature folds from its name or title down to the end:
// a politician's name over their role, or a member of staff's title. A
// top-posted reply folds everything from its quote's header down: Outlook's
// "From: … Sent: …" block (in Welsh too, for the Senedd), its line of
// underscores, "-----Original Message-----", a forward's header, an "On …
// wrote:" with no quote marks under it, or the "> " lines at its foot and the
// "On … wrote:" over them. One answered in between the quoted lines keeps
// those, as the reply needs them, and folds only the quote at its foot.

/** A message's parts: what it says, its lines rewrapped, and the quote and footer below that, empty if none. */
export type ReplyParts = { text: string; quoted: string };

/** A line quoted with "> ". */
const QUOTED = /^\s*>/;

/** Lines that start a quote of their own: an old mailer's header or a forward's. */
const QUOTE_LINE = /^\s*(-{2,}\s*(Original Message|Forwarded message)\s*-{2,}|_{10,}|Begin forwarded message:)\s*$/i;

/** The start of a quote's From block in English or Welsh, either maybe in bold, and what comes under it. */
const FROM_LINE = /^\s*\*?(From|Oddi wrth):/i;
const SENT_LINE = /^\s*\*?(Sent|Date|Anfonwyd|Dyddiad):/i;

/** The first and last lines of "On … wrote:", in English or Welsh, which a mailer may wrap; a time or year in it says it's a quote's. */
const WROTE_STARTS = /^\s*(On|Ar)\s/i;
const WROTE_ENDS = /\b(wrote|ysgrifennodd):\s*$/i;
const WROTE_DATE = /\d{1,2}[:.]\d{2}|\b\d{4}\b/;

/** A line starting what a mailer or an office adds under every message. */
const FOOTER_LINE =
  /^\s*\*?(UK Parliament Disclaimer|Sent from (my|Outlook|Mail)\b|Get Outlook for\b|Anfonwyd o['’]\w*|DISCLAIMER\b|CONFIDENTIALITY( NOTICE)?\b|This (e-?mail|message)\b.{0,60}\b(confidential|intended|privileged)\b|Your personal information and what rights\b|Privacy (Policy|Notice)\s*:)/i;

/** A ruled line, as HTML mail's comes as plain text, over a footer. */
const RULE_LINE = /^\s*-{10,}\s*$/;

/** The footer a Google Group adds to each message it passes on, under a line of "--". */
const SEPARATOR_LINE = /^--\s*$/;
const GROUP_FOOTER = /^\s*You received this message because you are subscribed to the Google Groups\b/i;

/**
 * A politician's role, as their signature gives it under their name:
 * "Member of Parliament for …", "MP for …", "MSP for …", "Member of the
 * Scottish Parliament for …", the Senedd's in English or Welsh, "MLA for …".
 * Maybe in bold.
 */
const ROLE_LINE =
  /^\s*\*?([A-Z][\w’'&-]* ){0,3}(Member of (the )?(Parliament|Scottish Parliament|Senedd|Welsh Parliament|Legislative Assembly) for|(MP|MSP|MS|MLA) for|Aelod o['’]r Senedd dros)\s/;

/**
 * A line saying who someone works for, or what as, as a member of staff
 * signs: "Office of …", "Senior Parliamentary Assistant", "Researcher",
 * "PA to …", "Office Manager"; or PauseAI's own "Director, PauseAI UK".
 */
const STAFF_LINE =
  /^\s*\*?\s*(([\p{L}'’-]+ ){1,3}[|,~–-] *\**)?(Office of|On behalf of|(Senior )?Parliamentary (Assistant|Researcher)|Researcher|Case ?worker|Office Manager|Head of Office|Chief of Staff|PA to|Personal Assistant|Diary Manager|Communications Officer|Director,? PauseAI UK\W*$)/iu;

/** How long a signature's name or title line can be, and how many come over its role. */
const SIGNATURE = { longest: 70, above: 3 };

/** A sign-off, which stays with what the message says: "Kind regards", "Best wishes", "Yours sincerely". */
const SIGN_OFF =
  /^\W*(kind(est)? |best |warm(est)? |many )?(regards|wishes|thanks|thank you|yours\b.*|sincerely|cheers)\W*$/i;

/** A short line that ends no sentence and isn't a sign-off or a list's item, as a name or a title is. */
function nameLike(line: string): boolean {
  const trimmed = line.trim();
  return (
    trimmed !== "" &&
    trimmed.length <= SIGNATURE.longest &&
    !/[,.;:!?]$/.test(trimmed) &&
    !SIGN_OFF.test(trimmed) &&
    !KEEPS_ITS_LINE.test(trimmed)
  );
}

/**
 * Whether a signature starts at a line: the first after a blank line or a
 * sign-off (or a first name signed under it), of up to three short lines, a blank line allowed between each,
 * that are or lead to a politician's role under a name, or a line saying
 * who its writer works for or what as. The role ends no sentence, which
 * says it isn't one wrapped onto a line of its own.
 */
function startsSignature(lines: string[], i: number): boolean {
  const before = lines[i - 1]?.trim() ?? "";
  if ((before !== "" && !before.endsWith(",") && !SIGN_OFF.test(before)) || !nameLike(lines[i]!)) return false;
  // A first name signed on its own line, the signature after a blank line, stays with the message.
  if (!/\s/.test(lines[i]!.trim()) && !lines[i + 1]?.trim()) return false;
  let names = 0;
  for (let j = i; j < lines.length; j++) {
    const line = lines[j]!;
    if (!line.trim()) {
      if (!lines[j - 1]!.trim()) return false;
      continue;
    }
    if (ROLE_LINE.test(line)) return names > 0 && !/[.!?]\W*$/.test(line);
    if (!nameLike(line) || ++names > SIGNATURE.above) return false;
    if (STAFF_LINE.test(line)) return true;
  }
  return false;
}

/** Whether "On … wrote:" starts at a line, over text with no quote marks: "> " lines have their own way out, as a reply may answer between them. */
function startsUnmarkedWrote(lines: string[], i: number): boolean {
  if (!WROTE_STARTS.test(lines[i]!)) return false;
  const span = [0, 1, 2].find((n) => WROTE_ENDS.test(lines[i + n] ?? ""));
  if (span === undefined || !WROTE_DATE.test(lines.slice(i, i + span + 1).join(" "))) return false;
  const under = lines.slice(i + span + 1).find((line) => line.trim());
  return under !== undefined && !QUOTED.test(under);
}

/** Where what's folded starts, unmarked: a quote's header, a footer or a politician's signature. */
function startsFolded(lines: string[], i: number): boolean {
  const line = lines[i]!;
  if (QUOTE_LINE.test(line) || FOOTER_LINE.test(line) || startsUnmarkedWrote(lines, i)) return true;
  if (startsSignature(lines, i) || RULE_LINE.test(line)) return true;
  if (SEPARATOR_LINE.test(line) && GROUP_FOOTER.test(lines[i + 1] ?? "")) return true;
  return FROM_LINE.test(line) && lines.slice(i + 1, i + 4).some((next) => SENT_LINE.test(next));
}

/** How many of the lines at the end are the "On … wrote:" over a quote, which a mailer may wrap: 0 if they aren't. */
function wroteLines(lines: string[]): number {
  if (!WROTE_ENDS.test(lines.at(-1) ?? "")) return 0;
  const count = [1, 2, 3].find((n) => n <= lines.length && WROTE_STARTS.test(lines.at(-n)!));
  return count ?? 1;
}

/** Drops the blank lines at the end. */
function trimEnd(lines: string[]): string[] {
  let end = lines.length;
  while (end > 0 && !lines[end - 1]!.trim()) end--;
  return lines.slice(0, end);
}

/** The width past which a block's lines can't be a mailer's wrapping, and under which they needn't be. */
const WRAP_WIDTHS = { narrowest: 60, widest: 100 };

/** Whether a line starts a list's item or is quoted, which keep their own line. */
const KEEPS_ITS_LINE = /^\s*([-*•>]|\d+[.)])\s/;

/** A block of lines, its mailer's wrapping undone: a line that ends a sentence, or left room for the next's first word, was ended by its writer. */
function unwrappedBlock(block: string): string {
  const lines = block.split("\n");
  const width = Math.max(...lines.map((line) => line.length));
  if (width < WRAP_WIDTHS.narrowest || width > WRAP_WIDTHS.widest) return block;
  return lines.reduce((joined, next, i) => {
    if (i === 0) return next;
    const line = lines[i - 1]!;
    const wrapped =
      line.length + 1 + next.trimStart().split(" ")[0]!.length > width &&
      !/[.!?:]$/.test(line) &&
      !KEEPS_ITS_LINE.test(line) &&
      !KEEPS_ITS_LINE.test(next);
    return `${joined}${wrapped ? " " : "\n"}${next}`;
  }, "");
}

/** A text with its mailer's wrapping undone, block by block. */
function unwrapped(text: string): string {
  return text
    .split(/(\n[ \t]*\n)/)
    .map(unwrappedBlock)
    .join("");
}

/** A letter's kept text, to read: without a mailer's "> " or its wrapping. */
export function letterText(text: string): string {
  return unwrapped(text.replace(/^[ \t]*> ?/gm, ""));
}

/** A message's parts; all of it what it says if that would leave nothing. */
export function replyParts(text: string): ReplyParts {
  const all = text.split("\n");
  const unmarked = all.findIndex((_, i) => !QUOTED.test(all[i]!) && startsFolded(all, i));
  let lines = trimEnd(unmarked === -1 ? all : all.slice(0, unmarked));
  let quoted = false;
  while (lines.length && QUOTED.test(lines.at(-1)!)) {
    lines = trimEnd(lines.slice(0, -1));
    quoted = true;
  }
  if (quoted) lines = trimEnd(lines.slice(0, lines.length - wroteLines(lines)));
  if (!lines.length) return { text: unwrapped(text), quoted: "" };
  return { text: unwrapped(lines.join("\n")), quoted: all.slice(lines.length).join("\n").trim() };
}
