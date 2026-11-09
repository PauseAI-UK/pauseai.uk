import "server-only";
import type { Permission } from "@/lib/staff-permissions";
import { onParliamentDomain, politiciansOf } from "@/lib/one-off";
import type { ThreadMessages, ThreadStep } from "@/lib/politician-correspondence";
import { isMachineReply } from "@/lib/email-parsing/subjects";
import { query } from "./db";
import { threadsWithSomeoneElse } from "./one-off-emails";
import { politicianBook } from "./politician-book";

type Message = { id: number; at: string; name: string; address: string; fromUs: boolean };

/**
 * What the database knows of a politician's messages, for their page: a
 * letter's replies are theirs unless ours or the supporter's, and a one-off
 * message theirs only from their own address or a parliament's. Staff
 * without `supporters` get no supporter's or someone else's words or name:
 * a letter's messages from us and them, the name only off their office's
 * address, and nothing of a thread with someone else in it. The counts are
 * rough, as whether a one-off message was automatic is mostly in the message
 * itself, which isn't read here.
 */
export async function politicianMessages(id: number, permissions: readonly Permission[]): Promise<ThreadMessages> {
  const supporters = permissions.includes("supporters");
  const [replies, oneOffs, [{ letters }], book, hidden, subjects] = await Promise.all([
    query<Message & { fromSupporter: boolean; auto: boolean }>(
      `SELECT r.letter_id::int AS id, r.at, r.from_name AS name, r.from_address AS address, r.from_us AS "fromUs",
         r.from_supporter AS "fromSupporter",
         EXISTS (SELECT 1 FROM letter_events e WHERE e.letter_id = r.letter_id AND e.status = 'auto_reply'
           AND e.details->>'gmailMessageId' = r.gmail_message_id) AS auto
       FROM letter_replies r JOIN letters l ON l.id = r.letter_id
       WHERE l.notable_person_id = $1 AND ($2 OR NOT r.from_supporter) ORDER BY r.at, r.id`,
      [id, supporters],
    ),
    query<Message & { subject: string }>(
      `SELECT m.thread_id::int AS id, m.at, m.from_name AS name, m.from_address AS address, m.from_us AS "fromUs", m.subject
       FROM one_off_messages m JOIN one_off_thread_people tp ON tp.thread_id = m.thread_id
       WHERE tp.notable_person_id = $1 ORDER BY m.at, m.id`,
      [id],
    ),
    query<{ letters: number }>(
      "SELECT count(*)::int AS letters FROM letters WHERE notable_person_id = $1 AND status <> 'not_sent'",
      [id],
    ),
    politicianBook(),
    supporters ? ([] as number[]) : threadsWithSomeoneElse(),
    query<{ id: number; subject: string }>(
      `SELECT l.id::int AS id, coalesce(CASE WHEN $2 THEN s.subject END, m.subject, '') AS subject
       FROM letters l LEFT JOIN letters_from_supporters s ON s.id = l.id
         LEFT JOIN letters_from_pauseai p ON p.id = l.id LEFT JOIN mailings m ON m.id = p.mailing_id
       WHERE l.notable_person_id = $1`,
      [id, supporters],
    ),
  ]);
  const office = (address: string) => politiciansOf(book, address).includes(id) || onParliamentDomain(address);
  const named = (message: Message) => message.name || message.address;
  const messages: ThreadMessages = {
    letters: {},
    oneOffs: {},
    subjects: Object.fromEntries(subjects.map((letter) => [letter.id, letter.subject])),
    // One-off messages from anyone but their office: people copy policy@ into theirs to them.
    emailsToThem: letters + oneOffs.filter((message) => !office(message.address)).length,
    emailsFromThem:
      replies.filter((reply) => !reply.fromUs && !reply.fromSupporter && !reply.auto).length +
      oneOffs.filter(
        (message) => !message.fromUs && office(message.address) && !isMachineReply(() => undefined, message.subject),
      ).length,
  };
  const add = (to: Record<number, ThreadStep[]>, at: number, step: ThreadStep) => {
    (to[at] ??= []).push(step);
  };
  for (const reply of replies) {
    const { fromUs, fromSupporter, auto } = reply;
    const at = new Date(reply.at).toISOString();
    if (fromUs) add(messages.letters, reply.id, { at, who: "us", name: null, auto: false });
    else if (fromSupporter) add(messages.letters, reply.id, { at, who: "supporter", name: null, auto: false });
    else {
      const name = supporters || office(reply.address) ? reply.name || null : null;
      add(messages.letters, reply.id, { at, who: "them", name, auto });
    }
  }
  for (const message of oneOffs) {
    if (hidden.includes(message.id)) continue;
    const at = new Date(message.at).toISOString();
    if (message.fromUs) add(messages.oneOffs, message.id, { at, who: "us", name: null, auto: false });
    else {
      add(messages.oneOffs, message.id, {
        at,
        who: office(message.address) ? "them" : "other",
        name: named(message),
        auto: isMachineReply(() => undefined, message.subject),
      });
    }
  }
  return messages;
}
