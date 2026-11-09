# A letter's lifecycle in one place

Size: L. Kind: architecture.

## Problem

A letter's status is a state machine nobody wrote down. `letters.status` is set from five files (`letter-sending.ts`, `mailing-sending.ts`, `mailing-drafts.ts`, `relays.ts`, `delivery-problems.ts`), and only the claims check which status they move from. What "went" means is written five ways: `NEVER_WENT` in `lib/politician-correspondence.ts`, `LETTER_STATUSES` in `lib/staff-search.ts` (which leaves out scheduled, cancelled and skipped), an `IN (...)` list in `politicians.ts`, `status <> 'not_sent'`, and `IN ('scheduled','sending')` in `mailing-sending.ts`. Statuses are typed `string` in 25 places. `letter_events.status` has no CHECK and no type, and about 15 event names are written, some through `letterEvent()` and some by inline `INSERT`.

The send loop exists twice. `sendTaken` (`letter-sending.ts`) and `sendDueLetters` (`mailing-sending.ts`) each claim a letter, check blocks and the daily limit their own way, send, mark it sent and log the event. `MailingChannel` already abstracts how a mailing goes, but supporters' letters don't use it.

## Fix

`lib/letters/lifecycle.ts` holds a `LetterStatus` union; named sets such as `WENT` and `IN_FLIGHT`, each as a TypeScript check and as a SQL fragment; and `transition(id, from, to, event)`, one guarded `UPDATE … WHERE status = ANY(from)` with its event in the same statement, so status and history can't disagree. One `sendLetterVia(channel)` serves both pipelines, supporters' letters going through `MailingChannel`. Do it in that order: the sets first (S), then transitions, then the shared send. A new kind of letter or channel (SMS, post) then plugs in once.

## Hits

None yet.
