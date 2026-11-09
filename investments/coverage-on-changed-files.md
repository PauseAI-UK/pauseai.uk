# Coverage on changed files

Size: S. Kind: tools.

## Problem

Only `npm test`, both Vitest projects together, checks coverage, and it takes minutes: a median of about 72 seconds in agents' sessions, and up to 22. While writing tests for a few files there's no quick way to see what in them isn't covered. Agents have written `tmp/cov.sh`, `tmp/uncovered.js`, and `tmp/coverage-run.sh`, which moves the placeholder-copy test aside so coverage can be read while placeholders exist.

## Fix

`npm run test:changed` runs the tests for the files changed since `origin/main`, with coverage limited to those files, and lists each file's uncovered lines and branches. It reports coverage even while the placeholder check fails. `npm test` stays the gate.

## Hits

- Week of 2026-10-12 (x7): sessions measured coverage on a few files with their own script or flags
- Week of 2026-10-19 (x3): sessions measured coverage on a few files with their own script or flags
- Week of 2026-10-26 (x6): sessions measured coverage on a few files with their own script or flags
- Week of 2026-11-02 (x3): sessions measured coverage on a few files with their own script or flags
