# Netlify's build without the checks

Size: M. Kind: tools.

## Problem

`npm run build`, which Netlify runs on every deploy, runs the typecheck, the node tests and both linters before `next build`. CI has already run and required them before a PR can merge. Running them again costs build minutes, and it's why `describeWithDatabase` skips its tests on Netlify.

They can't simply go. Main's ruleset doesn't require a PR to be up to date with main, so two PRs that each pass CI can break main once both merge, and Netlify deploys main without waiting for main's CI. The build's checks are what catch that.

## Fix

Check main before a merge rather than after: a merge queue on main, with CI's workflow running on `merge_group` ([GitHub's docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)). Then Netlify's build runs `next build` alone, and the tests' skip on Netlify goes.

## Hits

None yet.
