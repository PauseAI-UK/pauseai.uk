# Fixtures out of `tests/`

Size: S. Kind: small fix.

## Problem

Production code imports the fixture-mode fakes from `tests/`: `lib/server/outside-services/gmail.ts`, `postmark.ts` and `outside-fetch.ts`, and `lib/server/flow-database.ts`. So the layering rule has exceptions, and the fakes ship in the production bundle.

## Fix

Move the fakes to `lib/server/fixtures/`, and have ESLint forbid importing `tests/` from `lib/` and `app/`.

## Hits

None yet.
