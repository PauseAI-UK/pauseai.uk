# One type for timestamps

Size: S. Kind: small fix.

## Problem

node-postgres returns a `timestamptz` column as a `Date`, but as a string when it's inside `json_build_object` (https://node-postgres.com/features/types). The row types follow whichever case their author met: `string` in 54 places, `Date` in 17. Some are wrong at runtime: `PauseaiLetter.at` (`letters.ts`) and `AuditEntry.at` (`audit.ts`) are typed `string` but are `Date`s, `staffTime(at: string)` is called with `Date`s, and `iso()` in `lib/politician-correspondence.ts` exists to paper over the difference.

## Fix

`Date` everywhere: keep node-postgres's default for columns, turn the times inside the four `json_build_object`s into `Date`s where they're read, and correct the 54 annotations that say `string`, and what they're passed to. A `Date` keeps milliseconds where Postgres keeps microseconds. The one query given a time it read, the daily report of supporters' bounces (`held-replies.ts`, the bounces since the last report), could at worst count again a bounce from the same millisecond as that report, which doesn't matter; a query where it would should compare in SQL.

## Hits

None yet.
