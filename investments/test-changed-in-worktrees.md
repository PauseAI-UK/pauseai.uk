# `npm run test:changed` in a worktree

Size: S. Kind: tools.

## Problem

In a worktree made by `npm run worktree`, `npm run test:changed` stops at
once: Vitest's `--changed` says "Could not find Git root. Have you
initialized git with `git init`?" and writes no coverage report, though
`git rev-parse --show-toplevel` works there. The worktree's `.git` is a
file pointing to `../../../.git/worktrees/<branch>`, a relative path, which
Vitest's own git lookup may not follow. So in a worktree the only way to see
coverage is the whole of `npm test`.

## Fix

Find what Vitest runs to find the root (its `VitestGit`), and either give
the worktree an absolute `gitdir` when `scripts/worktree.mjs` makes it, or
have `scripts/test-changed.mjs` pass Vitest the changed files itself
(`changedFiles` already lists them) rather than `--changed`.

## Hits

- 2026-11-18: in tmp/worktrees/staff-fixes, ran the whole `npm test` instead, ~5 min
- 2026-11-19: in tmp/worktrees/consents-redo, the same, so ran the gate's test group instead, ~3 min
