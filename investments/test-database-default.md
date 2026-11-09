# Tests that find Postgres without help

Size: M. Kind: tools.

## Problem

Agents set `TEST_DATABASE_URL` by hand on nearly every test command, though the tests already find a local Postgres themselves: with no `TEST_DATABASE_URL`, `scripts/fresh-database.mjs` looks for its socket in `/var/run/postgresql` or `/tmp`. Three things defeat that in the container agents work in (a Docker container under OrbStack on Francis's Mac, with `/pauseai.uk` and `/home/dev` mounted from the Mac):

- The shared checkout's `.env.local` belongs to Francis's Mac and sets `TEST_DATABASE_URL` to Docker's port 5433, which the container hasn't got. So in the shared checkout every test command must override it, and agents carry the habit into worktrees, where there's no `.env.local` and no need.
- Postgres isn't running when the container starts.
- When no socket is found, the tests fall back to TCP on localhost:5432 and fail with a raw `psql` error that doesn't say what to do.

## Fix

In the container's setup (not this repo), either in `/home/dev/.bashrc` or in whatever starts the container: set `TEST_DATABASE_URL=postgresql://dev@localhost/postgres?host=/var/run/postgresql`, which wins over `.env.local`, and run `pg-start`. Then drop the advice to set it by hand from agents' notes.

In this repo: when no server answers, the tests' global setup stops with a message saying where it looked and what to do (start Postgres, or set `TEST_DATABASE_URL`, `docs/testing.md`, "Where Postgres is").

## Hits

- Week of 2026-10-12 (x23): sessions set `TEST_DATABASE_URL` by hand
- Week of 2026-10-19 (x10): sessions set `TEST_DATABASE_URL` by hand
- Week of 2026-10-26 (x13): sessions set `TEST_DATABASE_URL` by hand
- Week of 2026-11-02 (x15): sessions set `TEST_DATABASE_URL` by hand
- 2026-11-09: `vitest run tests/checks/` in a new worktree failed with a raw `psql` error on localhost:5432, because Postgres wasn't running
