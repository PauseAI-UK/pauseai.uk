# A served branch and its storyboard, at once

Size: S. Kind: tools.

## Problem

`docs/development.md`, "Serving a branch", says `npm run serve`'s `next dev`
shares `.next` with the checkout, so a storyboard review mustn't run in the
same worktree meanwhile. While Francis is clicking round a served branch, its
storyboard review, and so the whole `npm run gate`, waits till he's done, or
the served site is stopped under him, losing its database and whatever he'd set
up in it.

Next 16 may already allow both. `next dev` writes to `.next/dev`, and
`next build` leaves `dev` alone when it clears `.next` (the CLI's docs in
`node_modules/next/dist/docs/01-app/03-api-reference/06-cli/next.md`, and the
clean step in `node_modules/next/dist/build/index.js`). Each takes its own lock
in its own folder. Nobody has tried it here.

## Fix

Serve a worktree and run its storyboard review beside it, then use the served
site. If both work, take the warning out of `docs/development.md` and say that
serving and a review can share a checkout. If something still clashes, such as
`next typegen` and `next-env.d.ts`, which both builds write, say what it is here.

## Hits

- 2026-11-23: in tmp/worktrees/broadcast-finish-time, stopped a served branch Francis was testing to run the gate, restarted it on a fresh database, and left the storyboard to CI, ~10 min
- 2026-11-23: in tmp/worktrees/edm-import, stopped a storyboard review partway to serve the branch for a copy round, then ran it again from the start once serving stopped, ~10 min
- 2026-11-23: in tmp/worktrees/mailing-replies-to-check, asked for a storyboard review while the branch was served; had to choose between them
