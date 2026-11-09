# A merge queue

Size: S. Kind: operations.

## Problem

The main branch's ruleset requires the CI checks but not an up-to-date branch. Two PRs that each pass on their own can break main together, such as two that add the same migration number, and Netlify deploys main without waiting for CI.

## Fix

Turn on a merge queue, with a `merge_group:` trigger in `ci.yml` (https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue), or at least require branches to be up to date.

## Hits

- 2026-11-07: two branches took the same migration number (CI run 42421736068)
