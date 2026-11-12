# A command for a query's plan on a full-size database

Size: S. Kind: tools.

## Problem

`docs/code-structure.md`, "How fast a query has to be", asks for a new list query to be checked on a database filled to a year's size, with `EXPLAIN (ANALYZE)` on the query as the code builds it. Nothing does either part:

- the fill is `generate_series` written afresh each time, table by table, to satisfy every constraint;
- the query's text is built in TypeScript from pieces (`SELECT_POLITICIANS`, the `sql` tag), so getting it as the code builds it takes a scratch test that spies on the pool.

## Fix

A script, such as `npm run plan -- <test file>`, that makes a database, fills the growing tables to a set size from one shared fill, runs the named loader, and prints each statement it ran with its plan, its time, and its cost on a never-analysed database.

## Hits

- 2026-11-12: wrote a scratch test in `lib/server/` to fill a database and print the politicians list's plans, ~30 min; it found a plan that took four seconds
