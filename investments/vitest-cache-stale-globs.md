# Vitest's module cache keeps stale globs

Size: S. Kind: small fix.

## Problem

Under coverage, Vitest caches each transformed module in `node_modules/.vitest-cache`, keyed by the file's own content. An `import.meta.glob` is expanded into that transform, so a test that globs a folder (`netlify/scheduled.test.ts` globs `netlify/functions/*/*.ts`) keeps the old list of files after a new one is added, until the test file itself changes. Locally the test fails on a file that's there; run alone without coverage, or in CI with no cache, it passes, so it looks flaky.

## Fix

Clear the cache when a glob's folder changes, or don't glob in tests: list the files with `fs.readdirSync` and import them, which isn't part of the transform. Until then, `rm -rf node_modules/.vitest-cache` fixes it.

## Hits

- 2026-11-11: the scheduled functions test failed only under `npm test` after a new function folder was added, ~20 min
- 2026-11-11: the same, after a rebase brought in `import-civicrm`, ~10 min
