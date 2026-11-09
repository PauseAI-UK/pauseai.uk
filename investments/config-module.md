# One place for configuration

Size: S. Kind: small fix.

## Problem

`process.env` is read in 17 files under `lib/server/`. `POLICY_INBOX` alone is read in several places and normalised four ways: with a default, with `|| null`, with `.trim().toLowerCase()`, with `.toLowerCase()`, and raw. `DATA_FIXTURES` is checked directly 14 times, partly bypassing `fixturesEnabled()`.

## Fix

A typed `lib/server/config.ts` that reads and normalises each variable once, and an ESLint ban on `process.env` elsewhere, as there already is for `NETLIFY_DB_URL`.

## Hits

None yet.
