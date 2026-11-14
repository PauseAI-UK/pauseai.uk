# The gate's test suites share one Postgres

Size: S. Kind: small fix.

## Problem

The gate runs `npm test` beside the backup Worker's tests, against the same Postgres. In CI they're separate jobs with their own services. `npm test` creates and drops a database for each test file that needs one, and each `DROP DATABASE … WITH (FORCE)` waits for a checkpoint, so dozens queue at once (`CheckpointDone` in `pg_stat_activity`). The backup Worker's `worker/rules.test.ts` makes a database from the whole schema, which takes about 7 seconds alone, and has timed out at 60 seconds in the gate. Timing its steps in a loop while `npm test` ran gave a stall of about 84 seconds in one run and nothing over 9 seconds in the next, so the cause isn't pinned down.

## Fix

Find what the backup test waits on during the stall, then either run the backup Worker's tests after `npm test` in the gate, or make `npm test` drop its databases without a checkpoint each.

## Hits

- 2026-11-11: `worker/rules.test.ts` timed out in the gate and passed alone; timing it under `npm test` reproduced a stall once in two runs, ~20 min
- 2026-11-12: `lib/server/db.server.test.ts` timed out at 30s in the gate (the file took 78s) beside the backup tests, and took 4s alone in three runs, ~5 min
- 2026-11-12: `scripts/fresh-database.test.ts` timed out at 30s in the gate (48s) with the load average at 73, and passed alone in 20s, ~5 min
- 2026-11-12: `scripts/fresh-database.test.ts` timed out at 30s in the gate again (39s), the load average at 42, and `npm test` passed alone straight after, ~5 min
- 2026-11-12: with a new worktree's run of main's storyboard going beside the gate, `scripts/fresh-database.test.ts` timed out twice at 30s, and the backup tests failed three ways: `createdb` ending "could not open file … Interrupted system call" in two files, and `backUp` timing out at 60s, ~10 min
- 2026-11-13: `lib/supporters/form-entries.server.test.ts`, `lib/server/stored-filters.server.test.ts` and `scripts/fresh-database.test.ts` timed out with a one-flow storyboard run going beside `npm test`, ~5 min
- 2026-11-14: `scripts/fresh-database.test.ts` timed out at 30s with ESLint and Knip running beside `npm test` and the load average over 30, and took 3s alone, ~5 min
- 2026-11-13: `scripts/fresh-database.test.ts` and `lib/server/db.server.test.ts` timed out at 30s in the gate beside a 533-flow storyboard review, and both passed alone in 4s, ~5 min
- 2026-11-12: `worker/rules.test.ts` timed out at 60s in the gate, the load average at 61, and the backup tests passed alone straight after, ~5 min
- 2026-11-13: with the storyboard rerunning most flows beside it, `lib/server/db.server.test.ts` timed out at 30s and `worker/rules.test.ts` at 60s in the gate (`npm test` took 4m16s, 1m30s the run before), and both passed alone in seconds, ~5 min
- 2026-11-13: `worker/rules.test.ts` timed out at 60s in the gate beside `npm test` and the storyboard, and passed alone in 22s. Timed alone, step by step: `pg_restore` 7.1s, `dropdb --force` 4.5s, `initdb` 2.4s, the schema's `psql` 1.5s, `createdb` 1.2s; the scratch server's `fsync=off` saved about 2s, ~20 min
- 2026-11-13: `worker/rules.test.ts` timed out at 60s and `lib/server/letters.server.test.ts`'s `afterAll` (dropping its database) at 60s, at the same time in the gate, the load average at 47; both passed alone in under 3s, ~5 min
- 2026-11-14: `lib/server/letters.server.test.ts`'s `afterAll` (closing and dropping its database) timed out at 60s in `npm test` alone, with another worktree's checks running beside it and the load average at 40; every test passed, ~5 min
