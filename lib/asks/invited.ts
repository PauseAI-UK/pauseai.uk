import { INVITED } from "./asks";

// Who has been asked, in SQL, for the queries that find or count them: by a
// letter, or by staff marking them (INVITED, lib/asks/asks.ts). Someone is
// invited while they've been asked either way and have no answer.

/**
 * A letter's statuses (lib/letters/status.ts) that put its ask to its
 * politician: it arrived, may have, or is on its way. Not one that bounced,
 * or was refused, stopped or skipped, which never reached them.
 */
export const ASKING_STATUSES = ["queued", "scheduled", "sending", "sent", "uncertain", "spam_complaint"] as const;

/**
 * The letters that put an ask to someone, a row each: who (`id`), which ask
 * (`ask`) and when (`at`). A supporter's letter puts its campaign's ask, and
 * one of ours its mailing's. `only` narrows them, by the letter `l`, such as
 * to one person's.
 */
export function askingLetters(only: string): string {
  return `SELECT l.notable_person_id AS id, coalesce(c.ask, m.ask) AS ask, coalesce(l.sent_at, l.created_at) AS at
    FROM letters l
      LEFT JOIN letters_from_supporters ls ON ls.id = l.id LEFT JOIN campaigns c ON c.slug = ls.campaign
      LEFT JOIN letters_from_pauseai lp ON lp.id = l.id LEFT JOIN mailings m ON m.id = lp.mailing_id
    WHERE l.status IN (${ASKING_STATUSES.map((status) => `'${status}'`).join(", ")})
      AND coalesce(c.ask, m.ask) IS NOT NULL AND ${only}`;
}

/** Whether the status in `column` (ask_statuses.status) is an answer, in SQL: any but INVITED. */
export function answerSql(column: string): string {
  return `${column} <> '${INVITED}'`;
}
