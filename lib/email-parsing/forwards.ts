// A forward's text split into the messages it carries, so a thread can show
// each as the email it was: a supporter forwarding their MP's reply to
// policy@ reads as the supporter's letter, then the MP's reply, then the
// forward itself.

/** A message a forward carries, as its quoted headers give it, and its own text. */
export type Forwarded = { from: string; to: string; cc: string; sent: string; subject: string; body: string };

/** The line a mailer puts over the message it forwards. */
const FORWARD_MARK =
  /^\s*(-{2,}\s*Forwarded message\s*-{2,}|Begin forwarded message:|-{2,}\s*Original Message\s*-{2,}|_{10,})\s*$/i;

/** A quoted header's line: its name and value, a mailer's bold or quoting marks around it. */
const FIELD = /^\s*>*\s*\*?(From|Sent|Date|To|Cc|Subject):\*?\s*(.*)$/i;

/** An "On … wrote:" line: what's between On and the address, and the address. */
const WROTE = /^\s*>*\s*On (.{5,180}?)\s*<?\s*([\w.+'&-]+@[\w.-]+\.\w+)\s*>?\s*wrote:\s*$/i;

/** The last time or year in an "On … wrote:" line's date, after which its writer's name begins. */
const DATE_END = /(\d{1,2}[:.]\d{2}(?::\d{2})?(?:\s*[AP]M)?|\b\d{4}\b),?/gi;

/** An "On … wrote:" line's date and name, split after its last time or year. */
function dateAndName(between: string): { sent: string; name: string } {
  const ends = [...between.matchAll(DATE_END)];
  const cut = ends.length ? ends.at(-1)!.index! + ends.at(-1)![0].length : between.length;
  return {
    sent: between.slice(0, cut).replace(/,$/, "").trim(),
    name: between
      .slice(cut)
      .replace(/^\s*(at\s)?/i, "")
      .trim(),
  };
}

/** Whether a message is a forward: by its subject, or a forward's mark in its text. */
function isForward(lines: string[], subject: string): boolean {
  return /^\s*(fwd?|fw)\s*:/i.test(subject) || lines.some((line) => FORWARD_MARK.test(line));
}

/** Where a quoted message starts in a text, and where its own text does. */
type Start = { at: number; body: number; message: Omit<Forwarded, "body"> };

/** A block of quoted headers from line `i`: a From line, and with it a Sent or Date line, as Outlook, Gmail and Apple Mail write them. */
function headersAt(lines: string[], i: number): Start | undefined {
  const fields = (from: number) => {
    const found: Record<string, string> = {};
    let end = from;
    for (let j = from; j < Math.min(lines.length, from + 12); j++) {
      const field = FIELD.exec(lines[j]);
      if (!field) {
        if (lines[j].trim()) break;
        continue;
      }
      const name = field[1].toLowerCase();
      if (name in found) break;
      found[name] = field[2].trim();
      end = j;
    }
    return { found, end };
  };
  const head = FIELD.exec(lines[i]);
  if (!head || head[1].toLowerCase() !== "from") return undefined;
  // Thunderbird puts Subject and Date over From.
  let first = i;
  while (first > 0 && FIELD.exec(lines[first - 1]) && !/^\s*>*\s*\*?from:/i.test(lines[first - 1])) first--;
  const { found, end } = fields(first);
  const sent = found.sent ?? found.date;
  if (sent === undefined) return undefined;
  return {
    at: first,
    body: end + 1,
    message: { from: found.from, to: found.to ?? "", cc: found.cc ?? "", sent, subject: found.subject ?? "" },
  };
}

/** An "On … wrote:" line at `i`, or over two lines where a mailer wrapped it. */
function wroteAt(lines: string[], i: number, subject: string): Start | undefined {
  const one = WROTE.exec(lines[i]);
  const two =
    !one && /^\s*>*\s*On /.test(lines[i]) && i + 1 < lines.length && WROTE.exec(`${lines[i]} ${lines[i + 1]}`);
  const match = one || two;
  if (!match) return undefined;
  const { sent, name } = dateAndName(match[1]);
  return {
    at: i,
    body: i + (one ? 1 : 2),
    message: { from: name ? `${name} <${match[2]}>` : match[2], to: "", cc: "", sent, subject },
  };
}

/** A quoted message's own text: without a forward's mark at its end, its quoting taken off if every line has it. */
function bodyOf(lines: string[]): string {
  let body = [...lines];
  while (body.length && (!body.at(-1)!.trim() || FORWARD_MARK.test(body.at(-1)!))) body.pop();
  const written = body.filter((line) => line.trim());
  if (written.length && written.every((line) => /^\s*>/.test(line)))
    body = body.map((line) => line.replace(/^\s*> ?/, ""));
  return body.join("\n").trim();
}

/**
 * A forward's text as the note its sender wrote over it and the messages it
 * carries, newest first as they're quoted; undefined if it isn't a forward or
 * carries none. Each carried message is cut at the next one's headers.
 */
export function forwardedMessages(text: string, subject: string): { own: string; forwarded: Forwarded[] } | undefined {
  const lines = text.replace(/\r/g, "").split("\n");
  if (!isForward(lines, subject)) return undefined;
  const starts: Start[] = [];
  for (let i = 0; i < lines.length; i++) {
    const start = headersAt(lines, i) ?? wroteAt(lines, i, starts.at(-1)?.message.subject || subject);
    if (start && start.at >= (starts.at(-1)?.body ?? 0)) {
      starts.push(start);
      i = start.body - 1;
    }
  }
  if (!starts.length) return undefined;
  return {
    own: bodyOf(lines.slice(0, starts[0].at)),
    forwarded: starts.map((start, n) => ({
      ...start.message,
      body: bodyOf(lines.slice(start.body, starts[n + 1]?.at ?? lines.length)),
    })),
  };
}
