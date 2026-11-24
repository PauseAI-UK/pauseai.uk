# Politicians' past addresses in a table

Size: M. Kind: architecture.

## Problem

`bookAddresses()` (`lib/letters/book.server.ts`), the SQL behind `politicianBook()` and the politicians list's email counts, reads politicians' past email addresses out of `audit_log`'s JSON, for matching one-off emails among them. So matching mail depends on the log-retention job keeping those entries (`POLITICIAN_HISTORY` in `lib/jobs/log-retention.server.ts`) and on the shape of an audit entry's details.

## Fix

Keep a politician's past addresses in `politician_addresses`, which already holds those Parliament lists, staff add and their offices', with a source of their own, written in the same transaction as the edit. The book reads that table alone, not the audit log. Retention keeps its exception, as the politician's page shows their history from the log (`politicianHistory` in `lib/politicians/records.server.ts`).

## Hits

- 2026-11-12: the politicians list's email counts look addresses up in the book in SQL, so each view of the list reads the past addresses out of `audit_log`'s JSON too
