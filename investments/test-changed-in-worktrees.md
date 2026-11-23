# `npm run test:changed` in a worktree

Size: S. Kind: tools.

## Problem

`npm run test:changed` stops at once: Vitest's `--changed` says "Could not
find Git root. Have you initialized git with `git init`?" and writes no
coverage report. It does so in a worktree made by `npm run worktree`, whose
`.git` is a file pointing to `../../../.git/worktrees/<branch>`, and in the
dev container's main checkout too, whose `.git` is a folder; yet
`git rev-parse --show-cdup`, the command Vitest runs to find the root
(`getRoot` in its `GitVCSProvider`), works in both from a shell. So the
cause is in how Vitest runs it, perhaps its working folder. Until then the
only way to see coverage is the whole of `npm test`.

## Fix

Find what Vitest runs to find the root (its `VitestGit`), and either give
the worktree an absolute `gitdir` when `scripts/worktree.mjs` makes it, or
have `scripts/test-changed.mjs` pass Vitest the changed files itself
(`changedFiles` already lists them) rather than `--changed`.

## Hits

- 2026-11-18: in tmp/worktrees/staff-fixes, ran the whole `npm test` instead, ~5 min
- 2026-11-19: in tmp/worktrees/consents-redo, the same, so ran the gate's test group instead, ~3 min
- 2026-11-19: in the main checkout, ran the affected test files by hand, then the whole `npm test`, ~10 min
- 2026-11-19: in tmp/worktrees/home-photos-load, ran the gate's test group instead, ~4 min
- 2026-11-23: in tmp/worktrees/maps-link-warning, ran the two affected test files by hand, then the gate's test group, ~3 min
