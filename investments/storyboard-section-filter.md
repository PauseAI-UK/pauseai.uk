# Narrowing a storyboard run to a section matches the checkout's path

Size: S. Kind: tools.

## Problem

`npm run storyboard -- <section>` passes the section on to Playwright, which takes it as a regular expression on each spec file's whole path. A worktree's folder is named after its branch (`tmp/worktrees/<branch>`), so a section whose name is part of the branch's matches every spec: `press` in a worktree named `weekly-press-survey` runs all of them. Nothing says so until the run is far longer than it should be.

## Fix

Have `scripts/storyboard.mjs` turn a bare section name into its spec's path (`tests/storyboard/<section>.spec.ts`), and refuse one that isn't a spec's name, listing those that are.

## Hits

- 2026-11-25: `press` ran all 777 flows with pictures, not the press section's, ~25 min
