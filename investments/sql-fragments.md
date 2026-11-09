# Composable SQL for lists

Size: M. Kind: architecture.

## Problem

Three list queries build their SQL by hand, each with its own `values.push(...)` returning `$n`: `all-letters.ts`, `politicians.ts` (`parameters()`) and `supporters.ts`. "Any of" and "not" filters are written twice. Two others, `sent-emails.ts` and `audit.ts`, use the `($n IS NULL OR …)` style instead.

## Fix

A small `sql` tagged template in `db.ts` that returns `{ text, values }` and composes fragments (`sql.join`, `sql.and`). Still plain SQL, no ORM. It's the data half of `staff-list-definition.md`, and can be adopted one list at a time.

## Hits

None yet.
