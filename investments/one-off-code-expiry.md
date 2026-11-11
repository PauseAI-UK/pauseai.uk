# Delete one-off jobs once run

Size: S. Kind: ways of working.

## Problem

One-off jobs stay after they've done their work. The old letters import is one (`docs/domain-concepts.md`): about 970 lines of code, 1,070 lines of tests, a 600-line fake mailbox and a 360-line storyboard section. Its test file is the slowest in the suite, 91 seconds, about a tenth of Vitest's time. Three of the eleven jobs in `JOBS` (`lib/import-runs.ts`) are one-offs.

## Fix

When a one-off job has run in production, delete it with its tests, fixtures and flows, as `docs/testing.md` already says for data-migration tests. A one-off job is easy to find: its schedule in `JOBS` is `oneOff`.

## Hits

None yet.
