# CI's merged coverage, reproduced here

Size: S. Kind: tools.

## Problem

CI runs the tests in three shards and merges their coverage (`scripts/merge-coverage.mjs`), while `npm test` here is one run. A file can pass here and fail CI's merge, as the shards map a file differently from a whole run, and which tests land in which shard changes as tests are added. The failure names the file and a percentage, not the statement. To see which, the three `coverage-final.json` files have to be downloaded from the run by hand and read with a script.

## Fix

`npm run coverage:ci -- <run id>`: downloads the run's coverage artifacts to `tmp/`, merges them with `mergeShards`, and prints each statement, branch and function left uncovered, with its line and how each shard counted it.

## Hits

- 2026-11-24: `outside-fetch.server.ts` at 83% in CI and 100% here; downloaded the artifacts and compared the shards' statement maps by hand to find a fault in the merge, ~25 min
