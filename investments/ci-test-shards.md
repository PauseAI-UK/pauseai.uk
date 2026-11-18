# CI's Test job in shards

Size: S. Kind: tools.

## Problem

CI's Test job is its slowest: 6m46s on one PR's run (17 November 2026), against about 4 minutes for each storyboard shard, so a push waits on it. About 90s of that is setting up (Playwright's system packages 35s, the Postgres client 14s, Node 16s), and 197s running `npm test`.

Vitest splits a run into shards that each write a blob report, then merges them, coverage too (https://vitest.dev/guide/improving-performance#sharding). Tried locally on 17 November 2026: two shards of `vitest run --coverage --reporter=blob --shard=n/2` took 71s and 69s, against 145s for the whole run, so the work halves evenly. But `vitest run --merge-reports --coverage` then failed the statement threshold in seven files, all components with browser tests (`DonateForm.tsx`, `BroadcastWriter.tsx`, `CollateralStudio.tsx` and others): 16 statements of 21,790 uncovered, while branches, functions and lines were all at 100%, and the same tests unsharded pass. So the merge loses statements, perhaps where a component's node and browser tests land in different shards and their maps of it differ.

## Fix

1. Find why the merged statements differ: compare one of the seven files' coverage from an unsharded run with the merged one.
2. Then split the Test job into two shards and a merging job that checks the thresholds, in `.github/workflows/ci.yml`, which only Francis can push (`ci-workflow-pushes.md`).
3. Separately, run the jobs in Playwright's Docker image, which has the browsers' system packages, saving the 20 to 35s each job spends installing them (https://playwright.dev/docs/ci#via-containers); the Postgres 18 client would still need installing.

## Hits

- 2026-11-17: a CI run waited 6m46s on the Test job, the storyboard's shards done in under 5 minutes
