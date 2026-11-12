# Politicians' past addresses in a table

Size: M. Kind: architecture.

## Problem

`politicianBook()` reads politicians' past email addresses out of `audit_log`'s JSON (`politician-book.ts`), for its callers, matching one-off emails among them. So matching mail depends on the log-retention job keeping those entries (`POLITICIAN_HISTORY` in `log-retention.ts`) and on the shape of an audit entry's details.

## Fix

A `politician_addresses (person, address, from, until)` table, written in the same transaction as the edit. The book reads that table, not the audit log. Retention keeps its exception, as the politician's page shows their history from the log (`politicianHistory` in `politicians.ts`).

## Hits

- 2026-11-12: the politicians list's email counts look addresses up in the book in SQL, so each view of the list now reads the past addresses out of `audit_log`'s JSON too
