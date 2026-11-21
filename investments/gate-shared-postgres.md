# The gate's test suites share one Postgres

Size: S. Kind: small fix.

## Problem

The gate runs `npm test` beside the backup Worker's tests, against the same Postgres. In CI they're separate jobs with their own services. `npm test` creates and drops a database for each test file that needs one, and each `DROP DATABASE … WITH (FORCE)` waits for a checkpoint, so dozens queue at once (`CheckpointDone` in `pg_stat_activity`). The backup Worker's `worker/rules.test.ts` makes a database from the whole schema, which takes about 7 seconds alone, and has timed out at 60 seconds in the gate. Timing its steps in a loop while `npm test` ran gave a stall of about 84 seconds in one run and nothing over 9 seconds in the next, so the cause isn't pinned down.

What's known, from runs on 17 November 2026 in the dev container (14 cores, Postgres 18 with `fsync`, `full_page_writes` and `synchronous_commit` off):

- Each `DROP DATABASE` requests a checkpoint and waits for it: the server's `pg_stat_checkpointer` counted about 3,000 requested and none timed over 12 days. Drops that wait together share one: 20 at once took 97ms and two checkpoints.
- The storyboard drops a database for every flow, and `npm test` one for every test file, so both keep checkpoints frequent and small.
- `npm test`'s node tests alone take 39s; under CPU load (about 52) 114s; with seven workers copying and dropping databases beside them 135s, and all pass.
- Beside CI's storyboard (every flow, no pictures) at a load of about 27, they pass in 61s. Sampled every 2s, the only queries held over a second were drops waiting on `CheckpointDone`, up to 4.6s.
- With 20 more busy threads on top, a load of about 47, the same pair passed, the node tests in 131s; the longest drop waited 10.3s. So a failure needs more than that: a review taking pictures, say, or another worktree's checks too.
- At a load of about 100 (those 20 busy threads, three `npm test` runs in other worktrees and two storyboard reviews), the gate failed: six tests in `npm test` hit their 10s limits, `lib/email/email.server.test.ts` was stopped after 5 minutes, and the backup tests timed out at 60s. Twelve drops at once had waited 12 to 25s on `CheckpointDone`. So the failures do come from drops waiting on checkpoints once the machine is busy enough.
- Keeping every database until the end of each run, to drop them together, made it worse: with no drops for minutes, the writes built up, and a single drop (in `netlify/database/migrations.test.ts`) waited 63s on its checkpoint, failing two tests. So dropping less often isn't the fix. Neither is copying with no drops at all: seven workers copying unchecked failed five tests.
- A checkpoint on an idle server takes milliseconds even with 300 databases kept, so it's the load that makes one slow, not the number of databases.

## Fix

Not known yet. A failure reproduces at a load of about 100 (above); find what the checkpointer waits on: the bgwriter's settings, a lower `checkpoint_completion_target`, or the gate running the backup tests and `npm test` after the storyboard's build rather than beside it. Whatever's tried, measure the longest drop beside a real storyboard before and after, as above.

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
- 2026-11-13: `worker/rules.test.ts` timed out at 60s and `lib/letters/records.server.test.ts`'s `afterAll` (dropping its database) at 60s, at the same time in the gate, the load average at 47; both passed alone in under 3s, ~5 min
- 2026-11-14: `lib/letters/records.server.test.ts`'s `afterAll` (closing and dropping its database) timed out at 60s in `npm test` alone, with another worktree's checks running beside it and the load average at 40; every test passed, ~5 min
- 2026-11-16: `worker/rules.test.ts` failed in the gate beside `npm test` and the storyboard: `createdb` ending "could not open file "base/1/2610_vm": Interrupted system call", ~5 min
- 2026-11-19: `scripts/fresh-database.test.ts` timed out at 30s in the gate, with the linters and the backup tests beside `npm test` and a served branch's `next dev` running, and passed alone in 3s, ~5 min
- 2026-11-17: twice in the gate, the load average at 70 to 100 with most of it outside the container, `npm test` failed with about 20 database tests timing out at 10s, one `beforeEach`'s `TRUNCATE` (tests/database.ts) ending "deadlock detected", and the backup tests timing out at 60s, ~15 min
- 2026-11-17: `npm test` alone in the gate (`--only test`) had 17 database tests time out at 10s (statuses, guests' numbers, the hourly broadcast run, finding an MP), with four worktrees' runs of main's storyboard going and the load average at about 79, ~10 min
- 2026-11-17: in the gate beside the determinism check, the load average about 40, `scripts/fresh-database.test.ts` timed out at 41s and the backup tests' `worker/rules.test.ts` at 60s, ~5 min
- 2026-11-18: `container/backup.test.ts` failed in the gate beside `npm test`, with nothing else running: `createdb` ending "could not open file "base/1/2834": Interrupted system call", ~5 min
- 2026-11-21: `scripts/fresh-database.test.ts` and `lib/supporters/records.server.test.ts`'s `afterAll` timed out in `npm test` beside a briefings storyboard run, then `scripts/fresh-database.test.ts` alone timed out at 30s in a rerun of `npm test` by itself, the load average at 42; it passed alone in 4s, ~10 min
