# Coverage that depends on timing, checked on a schedule

Size: S. Kind: tools.

## Problem

A branch covered only when a timer or a connection happens to go one way passes `npm test` on a quiet machine and fails CI's per-file coverage gate on a loaded one, on a PR that never touched the file. `npm run coverage:timing` finds such branches (`scripts/README.md`, "Coverage"), but only when someone thinks to run it, and it takes about ten minutes.

## Fix

Run `npm run coverage:timing -- --runs 6 --at-once 2` nightly in CI, failing on any count that's none in one run and some in another, so each one found gets a test that reaches it on purpose. It's a change to `.github/workflows/`, which a maintainer pushes (`ci-workflow-pushes.md`).

## Hits

None yet.
