# Tests outside the gate share one Postgres on disk

Size: S. Kind: small fix.

## Problem

Dropping a database makes Postgres write every changed page on the server to disk first, the other databases' too, and the drop waits for it (`dropdb()` in Postgres's `src/backend/commands/dbcommands.c`). When something else is writing a lot to the same disk, the kernel makes those writes wait, and every test dropping a database waits with them. In the gate, `npm test` and the backup Worker's tests have a Postgres of their own, in memory (`scripts/gate-postgres.mjs`). Everything else shares the usual server, on the container's disk:

- the storyboard, which drops a database for every flow;
- `npm test` run by itself, or by another worktree, beside a storyboard.

Measured on 23 November 2026 in the dev container (14 cores), with seven processes copying and dropping the schema's database in a loop for two minutes:

- At a load of about 100 from busy CPUs alone, the longest drop took 0.8s. So CPU load doesn't do it.
- With four processes rewriting 2 GB files on the container's disk as well, 5 GB of changes waited to be written, and one checkpoint spent 17s writing. 51 drops took over 2s, and the longest took 13.4s.
- On a server in memory, under the same load, the longest checkpoint took 1.6s, 7 drops took over 2s, and the longest took 3.6s, waiting on the CPUs. On a separate server on the same disk, the longest drop took 6.4s.

The backup Worker's tests have also failed beside `npm test` with `createdb` ending "could not open file … Interrupted system call". The cause isn't known. It didn't happen in about 7,300 `createdb` runs beside a stream of forced drops, with and without the disk load, or in ten runs of `npm test` beside the backup tests. So the drops' signals to every connection don't seem to be it.

## Fix

- Give `npm test` a server of its own wherever it runs, from Vitest's global setup (`tests/vitest.global-setup.node.ts`), as `scripts/gate-postgres.mjs` does for the gate. Then the gate needs its own server only for the backup tests.
- Give the storyboard a server of its own in memory. Its fixture server would have to be started with it, and a server left from an earlier review on another Postgres refused.
- For the interrupted `createdb`, keep the whole error the next time it happens: which file, which database, what else was running. Then check whether it ever happens on the gate's own server.

## Hits

- 2026-11-12: the backup tests failed three ways with a new worktree's run of main's storyboard going beside the gate: `createdb` ending "could not open file … Interrupted system call" in two files, and `backUp` timing out at 60s, ~10 min
- 2026-11-14: `lib/letters/records.server.test.ts`'s `afterAll` (closing and dropping its database) timed out at 60s in `npm test` alone, with another worktree's checks running beside it and the load average at 40; every test passed, ~5 min
- 2026-11-16: `worker/rules.test.ts` failed in the gate beside `npm test` and the storyboard: `createdb` ending "could not open file "base/1/2610_vm": Interrupted system call", ~5 min
- 2026-11-18: `container/backup.test.ts` failed in the gate beside `npm test`, with nothing else running: `createdb` ending "could not open file "base/1/2834": Interrupted system call", ~5 min
- 2026-11-23: in tmp/worktrees/broadcast-tidy-ups, four database tests' hooks timed out (10s and 60s) beside a storyboard of all 699 flows; all passed alone, ~5 min
- 2026-11-23: in the gate (`--only test,checks`), the backup tests failed on `createdb` ending "could not open file … Interrupted system call" beside `npm test`, then passed alone three times, ~5 min
