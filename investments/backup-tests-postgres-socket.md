# The backup Worker's tests find Postgres where the site's do

Size: S. Kind: small fix.

## Problem

The site's tests look for the local Postgres's socket in `/var/run/postgresql` and then `/tmp` (`defaultHost` in `scripts/fresh-database.mjs`). The backup Worker's tests don't: `backup/container/test-database.ts` runs `createdb` with no host, so they find only the socket Postgres's tools were built to expect. With the server's socket in `/tmp`, `npm test` passes and the backup's tests fail, and the gate with them, until `PGHOST` is set by hand.

`pg-start` in the dev container puts the socket in `/var/run/postgresql`, so this shows only when that folder can't be written and the server is started with its socket elsewhere.

## Fix

Have the backup's tests find the server as `defaultHost` does, or the gate pass them the host it found.

## Hits

- 2026-11-18: `/var/run/postgresql` wasn't writable in the dev container, so Postgres was started with its socket in `/tmp`; the gate's backup tests failed until it was run with `PGHOST=/tmp`, ~10 min
- 2026-11-18: the same, in another checkout, while a broadcast change ran the gate, ~5 min
