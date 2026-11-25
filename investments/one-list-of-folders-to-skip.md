# One list of folders to skip

Size: S. Kind: small fix.

## Problem

The checks that walk the whole checkout each keep their own list of folders to skip: `scripts/placeholders.mjs`, `tests/checks/coverage-ignores.test.ts`, `tests/checks/doc-references.test.ts` and `scripts/storyboard-reach.mjs`. A new folder that something writes into the checkout, such as a served branch's build, has to be added to each, and a list that misses it fails on files no one wrote.

## Fix

One list of the folders that are generated, installed or local, in a module the checks share, or the checks walk `git ls-files` instead, which leaves out everything ignored.

## Hits

- 2026-11-25: `.next-serve` failed the placeholder and coverage-ignore checks with a branch being served, and had to go in three lists, ~15 min
