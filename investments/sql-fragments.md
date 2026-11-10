# Composable SQL for lists

Size: S. Kind: architecture.

## Problem

Three list queries still filter with fixed parameters, each condition written `($n IS NULL OR …)` with its number by hand: `letters.ts` (a campaign's letters, to `$13`), `sent-emails.ts` and `audit.ts`. Adding a filter means renumbering, and the planner sees every condition, whether it's on or not.

## Fix

Build them with the `sql` tagged template (`lib/server/sql.ts`), as `politicians.ts`, `supporters.ts` and `all-letters.ts` are: a condition only for each filter that's on, joined with `sql.where`. One list at a time.

## Hits

None yet.
