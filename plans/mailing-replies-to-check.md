# Mailing replies to check, and an alert for unanswered texts

## What it does

A politician's reply to a mailing's letter is "to check" (blue, as a
broadcast's reply is) until someone deals with it. Text replies to a
broadcast that nobody has dealt with get an email, so someone answers
within WhatsApp's 24 hours.

### Mailings

- A letter is "to check" while it has a reply from the politician's side
  (not ours, not automatic) that nothing has dealt with. Its state comes
  first, before answered and replied. Campaign letters never are.
- A reply is dealt with by any of these, at it or after it in the thread:
  - a message of ours in the thread, written in Gmail (kept by reading the
    mailbox) or sent with Reply on the site;
  - Nothing to do, pressed on it or a later reply;
  - a staff member setting the politician's answer to the mailing's ask
    after it came (`ask_statuses.updated_at`, `updated_by` a staff
    address, not an import).
- Worked out in SQL, not stored, but for Nothing to do
  (`letter_replies.dealt_by`, `dealt_at`). In production that leaves about
  27 letters to check, mostly mailing 119's, so no backfill.
- The letter's page: under the latest reply to check, Reply and Nothing to
  do. Reply only where the reply came to the policy inbox (POLICY_INBOX),
  or to the staff member's own mailbox; otherwise a line saying whose
  mailbox it went to, to answer there. Reply sends by Gmail from that
  mailbox, as the mailing's From name, in the thread, like a broadcast's
  answer (`letter_answers` for once-only sending and who sent it), then
  keeps it on the letter at once (`keepReply`), as reading skips our sends.
- Counts and a "Replies to check" tab on the mailing's page; a line a
  mailing on the dashboard's "needs a person".

### Text replies to broadcasts

- The sending job (every quarter hour) emails notification@, copying the
  broadcast's maker, for each broadcast with text replies waiting two
  hours or more that it hasn't emailed about: each reply, the hours left
  of its 24, a link to its thread. Once a reply (`broadcast_replies.alerted_at`).
- No email for email replies: the dashboard has them.

## Personal data

Nothing new about a person: staff who dealt with a reply or sent an
answer, as `broadcast_replies` keeps already. `docs/data-protection.md`
gets the answers in the politicians' row.

## Steps

1. Migration 0152: `letter_replies.dealt_by/dealt_at`, `letter_answers`,
   `broadcast_replies.alerted_at`, email purpose `mailing-answer`.
2. `lib/mailings/replies.server.ts`: the to-check SQL, Nothing to do,
   Reply's send. Letter states: `look` for mailings.
3. The letter page's actions; counts, tab, dashboard.
4. The text alert in the sending job.
5. Copy as placeholders, docs, storyboard flows.
