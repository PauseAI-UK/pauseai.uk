# Cancel superseded CI runs

Size: S. Kind: tools.

## Problem

Every push to a PR runs CI to the end, even after a newer push has replaced it: `.github/workflows/ci.yml` has no `concurrency:` group.

## Fix

A `concurrency:` group per ref, cancelling runs in progress on pull requests only (https://docs.github.com/en/actions/using-jobs/using-concurrency).

## Hits

- Week of 2026-11-02 (x23): PR runs carried on after a newer push to the same branch, about 68 minutes of runs between them
