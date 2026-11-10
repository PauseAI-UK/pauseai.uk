# A letter's lifecycle in one place

Size: S. Kind: architecture.

## Problem

`letter_events.status` has no CHECK. `LETTER_EVENTS` (`lib/letter-status.ts`) types the events the code writes, but the rows already there were never checked against it.

Some queries still say what counts as written to a politician their own way: `status <> 'not_sent'` (the politicians list's count, a politician's correspondence), which counts a stopped or skipped mailing letter, while `NEVER_WENT`, which a politician's correspondence thread uses, leaves them out.

## Fix

Decide whether a stopped or skipped letter counts as written, and use one set for it everywhere. Then check the events in production against `LETTER_EVENTS` and add the CHECK.

## Hits

None yet.
