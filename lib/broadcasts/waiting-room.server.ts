import "server-only";
import { textBackend } from "./channels.server";
import { broadcastsCopy } from "./copy";
import { keptInWords, type KeptWords } from "./whatsapp-messages";
import { notifyStaff, staffLink } from "@/lib/email/notifications.server";
import { refused, type FormResult } from "@/lib/form-result";
import { now } from "@/lib/now";
import { isInternational } from "@/lib/phone";
import { logChange } from "@/lib/server/audit.server";
import { query } from "@/lib/server/db.server";
import { sendText } from "@/lib/server/outside-services/whatsapp.server";
import { problem } from "@/lib/server/problems.server";
import { addFormEntry } from "@/lib/supporters/form-entries.server";
import { checkReply, type Checked } from "./waiting-room-check.server";
import { waitingRoomCopy, waitingRoomProblems } from "./waiting-room-copy";
import { asksToJoin, inviteLink, type WaitingState } from "./waiting-room";

// The waiting room (docs/domain-concepts.md, "The waiting room"): a message
// asking to join, from a number we don't have in it, starts a chat, and our
// number asks why they're interested. Their reply goes to the check
// (./waiting-room-check.server.ts): one that passes is let in, made a form entry and sent
// the community's link; the rest wait for staff, who let them in or dismiss
// them for good. Every message both ways is kept, for staff to read as a chat.

/** Someone in the waiting room, as the staff pages show them, with their chat, oldest first. */
export type WaitingPerson = {
  id: number;
  number: string;
  profileName: string;
  cameFrom: string | null;
  askedAt: Date;
  state: WaitingState;
  heldWhy: string | null;
  decidedBy: string | null;
  decidedAt: Date | null;
  linkSentAt: Date | null;
  /** The supporter they became once let in. */
  supporterId: number | null;
  messages: ChatMessage[];
};

/** A message in the chat: theirs, or ours. */
export type ChatMessage = { id: number; at: Date; ours: boolean; kind: string | null; body: string | null };

type Row = Omit<WaitingPerson, "messages" | "supporterId"> & { checkingSentAt: Date | null; entryId: number | null };

const COLUMNS = `w.id::int AS id, w.number, w.profile_name AS "profileName", w.came_from AS "cameFrom",
  w.asked_at AS "askedAt", w.state, w.held_why AS "heldWhy", w.decided_by AS "decidedBy", w.decided_at AS "decidedAt",
  w.link_sent_at AS "linkSentAt", w.checking_sent_at AS "checkingSentAt", w.entry_id::int AS "entryId"`;

async function personBy(where: string, value: string | number): Promise<Row | undefined> {
  const [row] = await query<Row>(`SELECT ${COLUMNS} FROM waiting_room w WHERE ${where} = $1`, [value]);
  return row;
}

/** The community's link: the one staff set last, with who set it and when, or none. */
export type CommunityLink = { link: string; setBy: string; setAt: Date };

export async function communityLink(): Promise<CommunityLink | undefined> {
  const [link] = await query<CommunityLink>(
    `SELECT link, set_by AS "setBy", set_at AS "setAt" FROM waiting_room_links ORDER BY set_at DESC, id DESC LIMIT 1`,
  );
  return link;
}

/** A message from them, kept once: false if WhatsApp sent it before, as it may. */
async function keepTheirs(personId: number, messageId: string, at: Date, kept: KeptWords): Promise<boolean> {
  const added = await query(
    `INSERT INTO waiting_room_messages (person_id, at, ours, kind, body, provider_message_id)
     VALUES ($1, $2, false, $3, $4, $5) ON CONFLICT (provider_message_id) DO NOTHING RETURNING id`,
    [personId, at, kept.kind, kept.body, messageId],
  );
  return added.length > 0;
}

/**
 * Sends them words of ours, and keeps them in the chat. Says whether they
 * went: WhatsApp takes our own words only within a day of their last
 * message, and a failure is reported, not thrown.
 */
async function say(person: Row, words: string): Promise<boolean> {
  const backend = await textBackend();
  if (!backend) return false;
  const sent = await sendText(backend.keys, backend.number.id, person.number, words);
  if (!sent.sent) {
    problem(waitingRoomProblems.notSent({ code: sent.code ?? 0 }));
    return false;
  }
  await query(
    `INSERT INTO waiting_room_messages (person_id, at, ours, body, provider_message_id) VALUES ($1, $2, true, $3, $4)`,
    [person.id, now(), words, sent.id],
  );
  return true;
}

/** The postcode on the form entry they became, if any. */
async function entryPostcode(entryId: number | null): Promise<string | null> {
  const [entry] = await query<{ postcode: string | null }>("SELECT postcode FROM form_entries WHERE id = $1", [
    entryId,
  ]);
  return entry?.postcode ?? null;
}

/**
 * Sends someone let in the community's link, asking for their postcode
 * under it if they gave none; marks it sent if it went. Says whether it did.
 */
async function sendLink(person: Row): Promise<boolean> {
  const link = await communityLink();
  if (!link) return false;
  const words = waitingRoomCopy.texts;
  const postcode = await entryPostcode(person.entryId);
  const sent = await say(person, postcode ? words.link(link.link) : `${words.link(link.link)}\n\n${words.postcode}`);
  if (sent) await query("UPDATE waiting_room SET link_sent_at = $2 WHERE id = $1", [person.id, now()]);
  return sent;
}

/** Their words since our welcome, one message a line, for the check. */
async function theirReply(personId: number): Promise<string> {
  const said = await query<{ body: string | null }>(
    `SELECT body FROM waiting_room_messages WHERE person_id = $1 AND NOT ours AND at > (
       SELECT min(at) FROM waiting_room_messages WHERE person_id = $1 AND NOT ours)
     ORDER BY at, id`,
    [personId],
  );
  return said.map((message) => message.body ?? "").join("\n");
}

/**
 * Lets someone in, by `by` (a staff member) or none (the check), with what
 * they gave: made a form entry, so a supporter, and sent the link, now if
 * WhatsApp lets us, else when they next write.
 */
async function letIn(person: Row, by: string | null, gave: Pick<Checked, "postcode" | "email">): Promise<void> {
  const entryId = await addFormEntry("whatsapp-join", {
    name: person.profileName,
    email: gave.email,
    phone: isInternational(person.number) ? person.number : null,
    city: null,
    postcode: gave.postcode,
    consent: true,
    utmSource: person.cameFrom,
  });
  await query(
    `UPDATE waiting_room SET state = 'let-in', decided_by = $2, decided_at = $3, entry_id = $4, held_why = NULL
     WHERE id = $1`,
    [person.id, by, now(), entryId],
  );
  await sendLink({ ...person, entryId });
}

/** Holds someone for staff, with the check's why, or none where it couldn't be asked. */
async function hold(personId: number, why: string | null): Promise<void> {
  await query("UPDATE waiting_room SET state = 'held', held_why = $2 WHERE id = $1", [personId, why]);
}

/** Their reply, checked: let in if it passes and there's a link to send, else held. */
async function checkAndDecide(person: Row): Promise<void> {
  const checked = await checkReply(await theirReply(person.id));
  if (checked?.verdict === "pass" && (await communityLink())) return letIn(person, null, checked);
  await hold(person.id, checked?.verdict === "hold" ? checked.reason : null);
}

/**
 * A later message from someone let in: their postcode or email, if it gives
 * one, on the entry they became; else, as it answers nothing of ours, to
 * staff, as any such message is.
 */
async function laterMessage(person: Row, number: string, kept: KeptWords): Promise<void> {
  const checked = kept.body ? await checkReply(kept.body) : null;
  if (checked?.postcode || checked?.email) {
    await query(
      "UPDATE form_entries SET postcode = coalesce($2, postcode), email = coalesce($3, email) WHERE id = $1",
      [person.entryId, checked.postcode, checked.email],
    );
    return;
  }
  const email = broadcastsCopy.notifications.whatsAppMessage;
  await notifyStaff(email.subject(number), email.body(number, keptInWords(kept)), null, "staff-alert");
}

/** A message to our number, as the webhook has it: from whom, its ID, when, what it says, and the message of ours it quotes. */
export type Incoming = {
  number: string;
  messageId: string;
  at: Date;
  kept: KeptWords;
  quoted?: string;
  profileName?: string;
};

/**
 * A message to our number, if it's the waiting room's: one from someone in
 * it, unless it quotes a message of ours that isn't the waiting room's (a
 * broadcast's), or one asking to join from a number not in it. Says whether
 * it was, so the webhook leaves it alone.
 */
export async function receiveWaitingRoomMessage(incoming: Incoming): Promise<boolean> {
  const { number, messageId, at, kept, quoted, profileName = "" } = incoming;
  if (quoted) {
    const [ours] = await query("SELECT 1 FROM waiting_room_messages WHERE provider_message_id = $1 AND ours", [quoted]);
    if (!ours) return false;
  }
  const words = kept.body ?? "";
  let person = await personBy("w.number", number);
  if (!person) {
    const asked = asksToJoin(words);
    if (!asked) return false;
    [person] = await query<Row>(
      `INSERT INTO waiting_room (number, profile_name, came_from, asked_at) VALUES ($1, $2, $3, $4)
       ON CONFLICT (number) DO NOTHING RETURNING ${COLUMNS.replaceAll("w.", "")}`,
      [number, profileName, asked.cameFrom, at],
    );
    if (!person) return true;
    await keepTheirs(person.id, messageId, at, kept);
    await say(person, waitingRoomCopy.texts.welcome);
    return true;
  }
  if (!(await keepTheirs(person.id, messageId, at, kept))) return true;
  if (profileName && profileName !== person.profileName) {
    await query("UPDATE waiting_room SET profile_name = $2 WHERE id = $1", [person.id, profileName]);
    person.profileName = profileName;
  }
  switch (person.state) {
    case "asked":
      // The button pressed again is no reply.
      if (!asksToJoin(words)?.cameFrom) await checkAndDecide(person);
      break;
    case "held":
      if (!person.checkingSentAt && (await say(person, waitingRoomCopy.texts.checking))) {
        await query("UPDATE waiting_room SET checking_sent_at = $2 WHERE id = $1", [person.id, now()]);
      }
      break;
    case "let-in":
      if (!person.linkSentAt || asksToJoin(words)) await sendLink(person);
      else await laterMessage(person, number, kept);
      break;
    case "dismissed":
      break;
  }
  return true;
}

/** Why staff can't let someone in or dismiss them: they've gone (erased), or there's no link to send. */
export type DecisionRefusal = "gone" | "no-link";

/**
 * Lets someone held, or who hasn't replied, in, by staff member `by`: what
 * they gave in the chat, as the check reads it, on the entry they become.
 * Someone decided meanwhile is left as they are.
 */
export async function letInByStaff(id: number, by: string): Promise<FormResult<DecisionRefusal>> {
  const person = await personBy("w.id", id);
  if (!person) return refused("gone");
  if (person.state === "let-in" || person.state === "dismissed") return { ok: true };
  if (!(await communityLink())) return refused("no-link");
  const reply = await theirReply(person.id);
  const checked = reply ? await checkReply(reply) : null;
  await letIn(person, by, { postcode: checked?.postcode ?? null, email: checked?.email ?? null });
  return { ok: true };
}

/** Dismisses someone for good, by staff member `by`. Someone decided meanwhile is left as they are. */
export async function dismiss(id: number, by: string): Promise<FormResult<"gone">> {
  const person = await personBy("w.id", id);
  if (!person) return refused("gone");
  await query(
    `UPDATE waiting_room SET state = 'dismissed', decided_by = $2, decided_at = $3
     WHERE id = $1 AND state IN ('asked', 'held')`,
    [id, by, now()],
  );
  return { ok: true };
}

/** Sets the community's link, by staff member `by`, as pasted: refused if it isn't an invite link. */
export async function setCommunityLink(pasted: string, by: string): Promise<FormResult<"not-a-link">> {
  const link = inviteLink(pasted);
  if (!link) return refused("not-a-link");
  await query("INSERT INTO waiting_room_links (link, set_by, set_at) VALUES ($1, $2, $3)", [link, by, now()]);
  await logChange(by, "set waiting room link", { link });
  return { ok: true };
}

/** Each person's chat, keyed by their ID. */
async function chats(ids: number[]): Promise<Map<number, ChatMessage[]>> {
  const messages = await query<ChatMessage & { personId: number }>(
    `SELECT id::int AS id, person_id::int AS "personId", at, ours, kind, body FROM waiting_room_messages
     WHERE person_id = ANY($1::bigint[]) ORDER BY at, id`,
    [ids],
  );
  const byPerson = new Map<number, ChatMessage[]>(ids.map((id) => [id, []]));
  for (const { personId, ...message } of messages) byPerson.get(personId)!.push(message);
  return byPerson;
}

const LISTED = `${COLUMNS}, l.supporter_id::int AS "supporterId"
  FROM waiting_room w LEFT JOIN supporter_links l ON l.form_entry_id = w.entry_id`;

async function withChats(rows: (Row & { supporterId: number | null })[]): Promise<WaitingPerson[]> {
  const byPerson = await chats(rows.map((row) => row.id));
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    profileName: row.profileName,
    cameFrom: row.cameFrom,
    askedAt: row.askedAt,
    state: row.state,
    heldWhy: row.heldWhy,
    decidedBy: row.decidedBy,
    decidedAt: row.decidedAt,
    linkSentAt: row.linkSentAt,
    supporterId: row.supporterId,
    messages: byPerson.get(row.id)!,
  }));
}

/** Everyone in one state, newest first (by when they asked, or were decided), with their chats; and how many are in each state. */
export async function waitingRoom(
  state: WaitingState,
): Promise<{ people: WaitingPerson[]; counts: Record<WaitingState, number> }> {
  const rows = await query<Row & { supporterId: number | null }>(
    `SELECT ${LISTED} WHERE w.state = $1 ORDER BY coalesce(w.decided_at, w.asked_at) DESC, w.id DESC LIMIT 100`,
    [state],
  );
  const counted = await query<{ state: WaitingState; n: number }>(
    "SELECT state, count(*)::int AS n FROM waiting_room GROUP BY state",
  );
  const counts = { held: 0, "let-in": 0, dismissed: 0, asked: 0 };
  for (const { state: each, n } of counted) counts[each] = n;
  return { people: await withChats(rows), counts };
}

/** A supporter's place in the waiting room, with their chat, if they came through it. */
export async function waitingRoomOf(supporterId: number): Promise<WaitingPerson | undefined> {
  const rows = await query<Row & { supporterId: number | null }>(
    `SELECT ${LISTED} WHERE l.supporter_id = $1 ORDER BY w.asked_at DESC LIMIT 1`,
    [supporterId],
  );
  return (await withChats(rows))[0];
}

/** How long after one email of who's held another can go. */
const HELD_EMAIL_HOURS = 24;

/**
 * Emails staff that people are held in the waiting room, at most once in
 * HELD_EMAIL_HOURS, with a link to it. `request` is the job's call, for the
 * link. Says whether it emailed.
 */
export async function emailHeld(request?: Request): Promise<boolean> {
  const [{ held }] = await query<{ held: number }>(
    "SELECT count(*)::int AS held FROM waiting_room WHERE state = 'held'",
  );
  if (held === 0) return false;
  const email = waitingRoomCopy.heldEmail;
  const [recent] = await query(
    `SELECT 1 FROM email_sends WHERE purpose = 'staff-alert' AND subject LIKE $1 AND at > $2`,
    [`%${email.subjectEnd}`, new Date(now().getTime() - HELD_EMAIL_HOURS * 60 * 60 * 1000)],
  );
  if (recent) return false;
  return notifyStaff(
    email.subject(held),
    email.body(held, staffLink("/staff/supporters/waiting-room", request)),
    null,
    "staff-alert",
  );
}
