# Politicians' past addresses in a table

Size: M. Kind: architecture.

## Problem

`politicianBook()` reads politicians' past email addresses out of `audit_log`'s JSON (`politician-book.ts`), for 8 callers including matching one-off emails and the old letters import. So the log-retention job must not delete those entries (`POLITICIAN_HISTORY` in `log-retention.ts`), which ties retention and domain logic together through untyped action strings (`audit-actions-typed.md`).

## Fix

A `politician_addresses (person, address, from, until)` table, written in the same transaction as the edit. The audit log goes back to being only a log, and retention loses its exception.

## Hits

None yet.
