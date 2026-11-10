# Tests that find Postgres without help

Size: S. Kind: tools.

## Problem

Agents set `TEST_DATABASE_URL` by hand on nearly every test command, though the tests find a local Postgres themselves: with no `TEST_DATABASE_URL`, `scripts/fresh-database.mjs` looks for its socket in `/var/run/postgresql` or `/tmp`. The habit came from an agent's note, now corrected, that the shared checkout's `.env.local` sends the tests to Docker's port 5433. That file is a symlink to Francis's Mac, and in the container it reaches a placeholder with no such line. What's left is that Postgres isn't running when the container starts, so the first test run of a session fails, now with a message saying to run `pg-start`.

## Fix

In the container's setup, not this repo: run `pg-start` when the container starts, or from `/home/dev/.bashrc`.

## Hits

- Week of 2026-10-12 (x23): sessions set `TEST_DATABASE_URL` by hand
- Week of 2026-10-19 (x10): sessions set `TEST_DATABASE_URL` by hand
- Week of 2026-10-26 (x13): sessions set `TEST_DATABASE_URL` by hand
- Week of 2026-11-02 (x15): sessions set `TEST_DATABASE_URL` by hand
- 2026-11-09: `vitest run tests/checks/` in a new worktree failed with a raw `psql` error on localhost:5432, because Postgres wasn't running
