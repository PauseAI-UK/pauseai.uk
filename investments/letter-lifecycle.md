# A letter's lifecycle in one place

Size: M. Kind: architecture.

## Problem

The send loop exists twice. `sendTaken` (`letter-sending.ts`) and `sendDueLetters` (`mailing-sending.ts`) each claim a letter, check blocks and the daily limit their own way, send, and mark it sent. `MailingChannel` already abstracts how a mailing goes, but supporters' letters don't use it.

`letter_events.status` has no CHECK. `LETTER_EVENTS` (`lib/letter-status.ts`) types the events the code writes, but the rows already there were never checked against it.

Some queries still say what counts as written to a politician their own way: `status <> 'not_sent'` (the politicians list's count, a politician's correspondence, a supporter's earlier letters in `mp-letters.ts`), which counts a stopped or skipped mailing letter, while `NEVER_WENT` leaves them out.

## Fix

One `sendLetterVia(channel)` serves both pipelines, supporters' letters going through `MailingChannel`, each moving its letter with `transition()` (`lib/server/letter-lifecycle.ts`). A new kind of letter or channel (SMS, post) then plugs in once. Then decide whether a stopped or skipped letter counts as written, and use one set for it everywhere. Last, check the events in production against `LETTER_EVENTS` and add the CHECK.

## Hits

None yet.
