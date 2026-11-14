import "server-only";
import { checkMailingDoc, letterFor, type MailingRecipientValues } from "./doc";
import { docFromMarkup } from "@/lib/letters/format";
import { letterText } from "@/lib/email-parsing/reply-text";
import { threadMessages, type LetterThread } from "@/lib/letters/threads.server";
import { query } from "@/lib/server/db.server";

// One of a mailing's letters and its thread, for staff, below what its page
// says of it (lib/letters/records.server.ts): the letter as it went, rebuilt
// from the mailing's letter and the values it was sent with, then each later
// message in the thread (lib/letters/threads.server.ts).

/** One of a mailing's letters and its thread; undefined if the mailing has no such letter. */
export async function letterThread(mailingId: number, letterId: number): Promise<LetterThread | undefined> {
  const [row] = await query<
    Omit<LetterThread, "letter" | "messages"> & {
      body: unknown;
      mergeValues: MailingRecipientValues | null;
      ownText: string | null;
    }
  >(
    `SELECT m.title AS "mailingTitle", m.subject, json_build_object('name', n.name, 'email', n.email) AS "to",
       l.sent_at AS "sentAt", coalesce(m.body, m.imported_text) AS body, p.merge_values AS "mergeValues", p.own_text AS "ownText",
       m.imported_text_approximate AS approximate,
       m.sent_from AS "sentFrom",
       -- With no name of its own, it went in the Gmail's, as that was when it last connected.
       coalesce(nullif(m.from_name, ''), (SELECT a.gmail_name FROM staff_accounts a WHERE a.email = m.sent_from)) AS "fromName",
       (SELECT s.gmail_thread_id FROM email_sends s WHERE s.letter_id = l.id AND s.outcome = 'sent'
        ORDER BY s.id DESC LIMIT 1) AS "gmailThreadId"
     FROM letters_from_pauseai p JOIN letters l USING (id) JOIN mailings m ON m.id = p.mailing_id
       JOIN notable_people n ON n.id = l.notable_person_id
     WHERE p.mailing_id = $1 AND l.id = $2`,
    [mailingId, letterId],
  );
  if (!row) return undefined;
  const { body: stored, mergeValues, ownText, ...thread } = row;
  const body = checkMailingDoc(stored);
  return {
    ...thread,
    letter: ownText ? docFromMarkup(letterText(ownText)) : body && mergeValues ? letterFor(body, mergeValues) : null,
    messages: await threadMessages(letterId),
  };
}
