# A checkout whose packages are behind its lockfile says so

Size: S. Kind: tools.

## Problem

A pull or rebase that brings a new `package-lock.json` doesn't install anything, so the checkout goes on running the old versions of its tools while CI runs the new. Nothing says so, and what fails looks like a flaky test or a bug in the code.

Vitest 5.0.5 kept each transformed module in `node_modules/.vitest-cache` by the file's own content, with any `import.meta.glob` expanded into it, so `netlify/scheduled.test.ts` went on seeing the old list of function folders after one was added. Vitest 5.1.0 leaves a file with a glob out of that cache. The lockfile had 5.1.0 for two days when checkouts still on 5.0.5 failed that test.

## Fix

Have the gate's fast checks fail when the installed packages aren't the lockfile's, saying to run `npm ci` (`npm ls` exits non-zero on a mismatch). The post-merge and post-checkout hooks could say the same when `package-lock.json` changed.

## Hits

- 2026-11-11: the scheduled functions test failed only under `npm test` after a new function folder was added, ~20 min
- 2026-11-11: the same, after a rebase brought in `import-civicrm`, ~10 min
- 2026-11-12: took the two failures above for a bug in Vitest's cache still to fix, until the installed version was compared with the lockfile's, ~15 min
