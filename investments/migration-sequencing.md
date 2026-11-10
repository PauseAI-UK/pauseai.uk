# Migrations across open PRs

Size: S. Kind: tools.

## Problem

Migrations are numbered one after another, and a pushed migration can't change. So when several PRs with migrations are open at once, each has to pick its number by looking at every other open PR by hand, and guess which merges first. If two take the same number, or one merges after a higher number it was meant to precede, the later one must be renamed, which a pushed migration can't be: it needs a new branch and PR. Nothing tells you the number you picked is taken until CI or the deploy fails.

## Fix

1. A script, run by `npm run worktree` and the gate, that lists the migrations in every open PR (`gh pr list` and `gh pr diff --name-only`) and says the next free number, warning when the branch's own number is taken by another open PR or not after main's last.
2. Then consider names that can't collide, such as a timestamp prefix, if Netlify's migrations apply them in name order whatever the prefix (not yet checked: https://docs.netlify.com/build/data-and-storage/netlify-db/).

## Hits

- 2026-11-07: two branches took the same migration number (CI run 42421736068)
- 2026-11-10: checked the open PRs by hand for their migration numbers before numbering one, and rebased after another's merged
