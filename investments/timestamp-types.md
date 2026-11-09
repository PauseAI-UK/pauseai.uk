# One type for timestamps

Size: S. Kind: small fix.

## Problem

node-postgres returns a `timestamptz` column as a `Date`, but as a string when it's inside `json_build_object` (https://node-postgres.com/features/types). The row types follow whichever case their author met: `string` in 54 places, `Date` in 17. Some are wrong at runtime: `PauseaiLetter.at` (`letters.ts`) and `AuditEntry.at` (`audit.ts`) are typed `string` but are `Date`s, `staffTime(at: string)` is called with `Date`s, and `iso()` in `lib/politician-correspondence.ts` exists to paper over the difference.

## Fix

One type parser in `db.ts` that returns every `timestamptz` as an ISO string, so the 54 annotations become true, and fix the 17 that say `Date`.

## Hits

None yet.
