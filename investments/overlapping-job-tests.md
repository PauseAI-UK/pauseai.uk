# Tests of jobs running at once

Size: S. Kind: operations.

## Problem

Sending mailings relies on `FOR UPDATE SKIP LOCKED` (`lib/server/mailing-sending.ts`), and send-mailings has a background twin, but no test runs two sends at once to check each letter goes once. The jobs' advisory locks are tested only by taking the lock by hand.

Reading Gmail has no lock, and two reads at once double-handle: each notes the same automatic reply (`noteAutoReply` in `lib/server/gmail-reading.ts` looks for the event, then adds it), so a letter's history shows it two or three times; and a bounce one read records makes the others fail on `email_problems_gmail`, so they report the account as unreadable. A scheduled read and a press on its page can overlap.

## Fix

A test helper that runs N copies of a job at once on one database and counts what the fake services received. Use it for send-mailings, read-gmail and import-luma.

Done: the helper (`atOnce`, `tests/at-once.ts`) and the tests for send-mailings (`lib/server/sending-job.test.ts`) and import-luma (`lib/server/luma-import.test.ts`). Left: read-gmail, once overlapping reads handle each message once, by a lock like import-luma's or by noting each message under a unique key.

## Hits

- 2026-11-09: the first test of three reads at once found an automatic reply noted up to three times, and two of the reads failing on a bounce the third had recorded
