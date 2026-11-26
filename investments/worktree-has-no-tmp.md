# A new worktree has no tmp/

Size: S. Kind: tools.

## Problem

`npm run worktree` makes a checkout with no `tmp/` folder. AGENTS.md says to run the gate in the background with its output going to a file in `tmp/`, so the first `npm run gate > tmp/….log` in a new worktree fails at once, because the shell can't open the log, before the gate starts.

## Fix

Have `scripts/worktree.mjs` make `tmp/` in the new checkout.

## Hits

- 2026-11-25: the first gate in a new worktree failed on the missing log folder and had to be started again, ~2 min
- 2026-11-26: a test run writing its log to tmp/ in a new worktree failed on the missing folder, ~2 min
