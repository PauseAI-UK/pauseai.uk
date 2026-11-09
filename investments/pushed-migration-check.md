# A check that pushed migrations are unchanged

Size: S. Kind: operations.

## Problem

Once a migration is pushed it can't change, or Netlify refuses the deploy (AGENTS.md, "Migrations are fixed once pushed"). Agents check this by hand with `git log` before each edit. `netlify/database/migrations.test.ts` checks names, numbers and transactions, but not whether a pushed migration has changed.

## Fix

A CI step that fails if a migration on `origin/main` differs on the branch, and a prek pre-push hook that fails if one on `origin/<branch>` differs locally (https://prek.j178.dev/). Perhaps Squawk as well, to flag migrations that lock tables or drop data (https://squawkhq.com/).

## Hits

- 2026-11-05: an agent was about to change a migration Francis had pushed; he caught it and asked for the rule in AGENTS.md
- 2026-11-07: two branches took the same migration number (CI run 42421736068)
