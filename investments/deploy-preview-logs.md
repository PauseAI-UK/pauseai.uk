# Deploy preview failures an agent can read

Size: S. Kind: tools.

## Problem

When a deploy preview fails, GitHub shows only "Deploy Preview failed" and a link to Netlify's log, which needs a Netlify login. Agents have none, so they can't see why it failed and must ask someone with a Netlify login to paste the log. Nothing warns, either, when a branch is behind main on migrations, though a preview's database may already have main's newer ones.

## Fix

A script that fetches a preview's deploy log through Netlify's API with a read-only token kept in `tmp/env`, printing the lines from the first error. Then teach `scripts/migration-order.mjs` to warn when main has migrations the branch lacks, saying to rebase.

## Hits

- 2026-11-13: a preview failed with no log to read, after main gained two migrations the branch lacked; rebasing on a guess fixed it, ~15 min
- 2026-11-14: a preview of a branch that changes only the storyboard's code and docs failed in 12 seconds, with no log to read and nothing to guess from, ~10 min
- 2026-11-16: every preview of a branch failed after another PR's migration merged; the branch's own migration came after it, so the order check passed, and someone with a Netlify login had to paste the log ("0132 has been removed after being applied") before a rebase fixed it, ~20 min
