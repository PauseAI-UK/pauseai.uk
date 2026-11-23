# A served branch and its storyboard, at once

Size: S. Kind: tools.

## Problem

`npm run serve` runs `next dev` in the branch's worktree, and the storyboard
builds the same worktree with `next build`. Both write its `.next` folder, so
they can't run at once (AGENTS.md says never two builds in one checkout). While
Francis is clicking round a served branch, its storyboard review, and so the
whole `npm run gate`, has to wait till he's done, or the served site is stopped
under him, losing its database and whatever he'd set up in it.

## Fix

Give one of them a build folder of its own: `next dev` takes `distDir` from
`next.config.ts`, so `scripts/serve.mjs` could set an env var that points it at
`.next-serve` (gitignored), leaving `.next` to the storyboard and the gate. Check
the storyboard's reach and `next build` ignore the second folder.

## Hits

- 2026-11-23: in tmp/worktrees/broadcast-finish-time, stopped a served branch Francis was testing to run the gate, restarted it on a fresh database, and left the storyboard to CI, ~10 min
