# Queries priced over JIT's threshold

Size: S. Kind: tools.

## Problem

CI's Postgres compiles any query the planner prices over 100,000 before running it, which can take seconds, so a test that runs one can time out in CI and pass here in milliseconds (docs/code-structure.md, "How fast a query has to be"). Seeing the prices takes four manual steps and reading Postgres's log by eye, so it's done only after a test has failed in CI.

On a fresh test database, the tests in `lib/supporters/` still run some over it: `listSupporters()` (`lib/supporters/records.server.ts`) with a search or a filter on `supporter_contact` or `supporter_identity`, at 118,000 to 179,000, both the page and its count (19 November 2026).

## Fix

1. A script that runs the given test files with `auto_explain` on, resets it after, and lists each query priced over 100,000 with its text and the most it cost.
2. Bring `listSupporters()`'s filtered queries under 100,000, with the doc's techniques.
3. Perhaps a check in the tests that fails on any query over the threshold, so one is caught before CI times out on it.

## Hits

- 2026-11-19: wrote a script in tmp/ to turn on auto_explain, run a test file and list the plans over 100,000, to find why the erasure test timed out in CI, ~20 min
