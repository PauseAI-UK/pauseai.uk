# A check that the docs' references exist

Size: S. Kind: tools.

## Problem

The docs name code by path and by name (`lib/server/import-runs.ts`, `asRun()`), and cite each other by heading (`docs/testing.md`, "Coverage"). Nothing checks that what they name exists, so a rename in the code leaves the doc pointing at nothing: a review of every doc against the code found functions, types and columns that had gone, among them a query in `docs/development.md` that failed as written.

## Fix

A test in `tests/checks/` that reads every Markdown file and fails on a backticked path that isn't in the repo, and on a cited heading or bold lead-in that its doc doesn't have. Plans and investments name files they propose, so those need a way to say so, or to be left out. Names of functions and columns are harder to check and can wait.

## Hits

- 2026-11-11: wrote a script in tmp/ to check every cited heading and backticked path in the docs, ~10 min
