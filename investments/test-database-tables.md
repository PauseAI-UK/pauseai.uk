# The test database's table list

Size: S. Kind: small fix.

## Problem

`tests/database.ts` lists by hand the 42 tables to empty between tests, plus a separate `DELETE` from `mailings` for the rows migrations seed. A new table must be added there, or its rows leak from one test into the next. `job_presses` is already missing: `app/(staff)/staff/actions.test.ts` inserts into it, and passes only because it deletes its own row at the end.

## Fix

Read the tables from `pg_tables` once, leaving out those whose rows migrations seed. While there, measure `CREATE DATABASE … STRATEGY FILE_COPY` in `scripts/fresh-database.mjs`, which may copy the template faster (https://www.postgresql.org/docs/current/sql-createdatabase.html).

## Hits

- 2026-11-09: found `job_presses` missing from the list
- 2026-10-15: 2ad6dbfe edited the list
- 2026-10-16: a50a1a23 edited the list
- 2026-10-19: f0aff071 edited the list
- 2026-10-21: e61f9fcc edited the list
- 2026-10-21: 3e5b7f73 edited the list
- 2026-10-21: 42583cb9 edited the list
- 2026-10-21: 37d048db edited the list
- 2026-10-21: c52336f1 edited the list
- 2026-10-22: b72abe1b edited the list
- 2026-10-26: afce9e62 edited the list
- 2026-10-27: 8a3ce868 edited the list
- 2026-10-27: a917e6b2 edited the list
- 2026-10-27: 434e77bb edited the list
- 2026-10-28: 68906753 edited the list
- 2026-10-28: ace7b514 edited the list
- 2026-10-29: 81cc24f1 edited the list
- 2026-11-02: b5dce60e edited the list
- 2026-11-05: 38153e2a (#219) edited the list
- 2026-11-06: 726f39a6 (#225) edited the list
- 2026-11-06: c4beca45 (#232) edited the list
