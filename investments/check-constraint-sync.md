# CHECK lists in step with TypeScript

Size: S. Kind: small fix.

## Problem

Several columns list their allowed values twice: in a TypeScript constant and in a SQL CHECK constraint. Examples are `SAVED_LISTS` and `saved_filters_list_check`, `HOUSES` and `PERSON_STATUSES` in `lib/server/politicians.ts`, `LETTER_STATUSES` in `lib/staff-search.ts`, and the form names. Adding a value means changing both and writing a migration, and nothing catches one that's left out until it fails at runtime.

## Fix

A test over the template database that maps each `table.column` to its TypeScript constant and compares the values in its CHECK, read from `pg_constraint`.

## Hits

- 2026-10-14: migration 0004 dropped and rebuilt a CHECK constraint
- 2026-10-15: migration 0010 dropped and rebuilt a CHECK constraint
- 2026-10-19: migration 0014 dropped and rebuilt a CHECK constraint
- 2026-10-21: migration 0016 dropped and rebuilt a CHECK constraint
- 2026-10-22: migration 0026 dropped and rebuilt a CHECK constraint
- 2026-10-22: migration 0027 dropped and rebuilt a CHECK constraint
- 2026-10-23: migration 0032 dropped and rebuilt a CHECK constraint
- 2026-10-26: migration 0034 dropped and rebuilt a CHECK constraint
- 2026-10-26: migration 0036 dropped and rebuilt a CHECK constraint
- 2026-10-27: migration 0043 dropped and rebuilt a CHECK constraint
- 2026-10-27: migration 0044 dropped and rebuilt a CHECK constraint
- 2026-10-28: migration 0057 dropped and rebuilt a CHECK constraint
- 2026-10-29: migration 0060 dropped and rebuilt a CHECK constraint
- 2026-10-29: migration 0063 dropped and rebuilt a CHECK constraint
- 2026-11-02: migration 0067 dropped and rebuilt a CHECK constraint
- 2026-11-03: migration 0073 dropped and rebuilt a CHECK constraint
- 2026-11-03: migration 0074 dropped and rebuilt a CHECK constraint
- 2026-11-05: migration 0075 dropped and rebuilt a CHECK constraint
- 2026-11-06: migration 0079 dropped and rebuilt a CHECK constraint
- 2026-11-06: migration 0080 dropped and rebuilt a CHECK constraint
- 2026-11-07: migration 0087 dropped and rebuilt a CHECK constraint
