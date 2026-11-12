# now() in concurrent upserts

Size: S. Kind: small fix.

## Problem

`now()` is when a statement's transaction began. An `INSERT … ON CONFLICT
DO UPDATE` that waited on another request's new row can set a time earlier
than the row's own, so a `CHECK` such as `last_seen >= first_seen` fails,
but only when two requests race, as under a loaded test run. `errors_seen`
had one, which made a test flaky.

## Fix

Search the queries that set a time in `ON CONFLICT DO UPDATE` or an
`UPDATE` of a row others may have just written, and make each keep the
later of the two (`greatest(column, now())`), or use `clock_timestamp()`
where the moment itself matters.

## Hits

- 2026-11-11 (x3): `errors-seen.test.ts`'s error thrown three times at once lost counts in loaded runs: a waiting upsert set `last_seen` before `first_seen`, and the check refused it (the failure was only reported, as `errorNotKept`); fixed in `errors-seen.ts`, ~15 min
- 2026-11-11: `errors-seen.test.ts` kept two problems at once and expected the second's words to be the latest, which a loaded run flipped; made it keep them one after the other, ~10 min
