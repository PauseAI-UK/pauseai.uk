// How a copy of something sent to many went: a broadcast's copy to a
// supporter, or a letter to a politician (docs/domain-concepts.md, "How a
// copy went"). Each copy is in one state, which gives its tag, its colour and
// the count it's in. A broadcast works its states out in
// lib/broadcasts/pages.server.ts; a letter's are here, as its tag needs them
// wherever it's shown.

import { statusIn } from "./status";

/** A state's colour: red bad, amber sad, green good, blue for staff to do; none for normal, grey. */
export type StateTone = "red" | "amber" | "green" | "blue";

/** Every state's colour, a broadcast's copy's and a letter's; one not here is grey. */
export const STATE_TONES: Record<string, StateTone> = {
  look: "blue",
  "opted-out": "red",
  spam: "red",
  error: "red",
  unreached: "amber",
  answered: "green",
  replied: "green",
  read: "green",
  delivered: "green",
};

/** The states of those that didn't go; the rest went, or are still to go. */
export const DIDNT_GO = new Set(["error", "unreached", "not-sent"]);

/** Why a mailing skipped a recipient: their address blocked, out of office, or in office with no address. */
export type SkipReason = "blocked" | "left-office" | "no-email";

/**
 * A letter's states, each counted, the first that applies: the office marked
 * it as spam; something broke (Gmail or Postmark refused it, or its send cut
 * off, so it may or may not have gone); it didn't reach them (it bounced);
 * not sent, as expected (no address, left office, address already blocked,
 * we stopped the mailing); their answer to its ask is recorded; they
 * replied; sent, saying so when only an automatic reply came back. A letter still to go is queued, scheduled or sending, and in
 * no count.
 */
export const LETTER_STATES = ["spam", "error", "unreached", "not-sent", "answered", "replied", "sent"] as const;
export type CountedLetterState = (typeof LETTER_STATES)[number];
export type LetterState = CountedLetterState | "queued" | "scheduled" | "sending";

/** Where a letter stands (LETTER_STATES), and why, where that state has one. */
export function letterState({
  status,
  skipReason,
  answered,
  replied,
  autoReplied,
  sentBy,
}: {
  status: string;
  skipReason?: SkipReason | null;
  answered: boolean;
  replied: boolean;
  /** Whether only an automatic reply came back, which is no reply. */
  autoReplied?: boolean;
  /** What sends it, to say what refused one that failed; unknown for a supporter's. */
  sentBy?: string | null;
}): { state: LetterState; why: string | null } {
  if (status === "queued" || status === "scheduled" || status === "sending") return { state: status, why: null };
  if (status === "spam_complaint") return { state: "spam", why: null };
  if (status === "uncertain") return { state: "error", why: "unfinished" };
  if (status === "not_sent") return { state: "error", why: sentBy ?? null };
  if (status === "bounced") return { state: "unreached", why: "bounced" };
  if (status === "cancelled") return { state: "not-sent", why: "cancelled" };
  if (status === "skipped") return { state: "not-sent", why: skipReason ?? null };
  if (answered) return { state: "answered", why: null };
  if (replied) return { state: "replied", why: null };
  return { state: "sent", why: autoReplied ? "auto-reply" : null };
}

/**
 * letterState in SQL, of the letter `l`, `answered` its condition for its
 * politician having answered the ask: for counting letters by state, and
 * listing those in one.
 */
export function letterStateSql(answered: string): string {
  return `CASE
    WHEN l.status IN ('queued', 'scheduled', 'sending') THEN l.status
    WHEN l.status = 'spam_complaint' THEN 'spam'
    WHEN ${statusIn("l.status", ["uncertain", "not_sent"])} THEN 'error'
    WHEN l.status = 'bounced' THEN 'unreached'
    WHEN ${statusIn("l.status", ["cancelled", "skipped"])} THEN 'not-sent'
    WHEN ${answered} THEN 'answered'
    WHEN l.replied_at IS NOT NULL THEN 'replied'
    ELSE 'sent' END`;
}

/** Whether the politician of a campaign `c`'s letter `l` has answered its ask, in SQL. */
export const CAMPAIGN_ANSWERED =
  "EXISTS (SELECT 1 FROM ask_statuses st WHERE st.notable_person_id = l.notable_person_id AND st.ask = c.ask)";

/** A campaign `c`'s letter `l`'s state (letterStateSql). */
export const CAMPAIGN_LETTER_STATE = letterStateSql(CAMPAIGN_ANSWERED);
