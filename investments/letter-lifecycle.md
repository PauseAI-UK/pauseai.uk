# A letter's lifecycle in one place

Size: S. Kind: architecture.

## Problem

`letter_events.status` has no CHECK. `LETTER_EVENTS` (`lib/letter-status.ts`) types the events the code writes, but the rows already there were never checked against it.

## Fix

Check the events in production against `LETTER_EVENTS` and add the CHECK.

## Hits

None yet.
