# `npm run test:changed` in the dev container

Size: S. Kind: tools.

## Problem

`npm run test:changed` stops at once: Vitest's `--changed` says "Could not
find Git root. Have you initialized git with `git init`?" and writes no
coverage report, in a worktree and in the main checkout alike. Vitest finds
the root by running `git rev-parse --show-cdup` through tinyexec, which puts
the folder Node runs from first on the `PATH`. In the dev container that's
`/usr/bin`, whose git (2.47) is older than the shell's `/usr/local/bin/git`
(2.56), and it refuses the repository: "unknown repository extension found:
relativeworktrees", the extension `git worktree add --relative-paths` sets in
the shared `.git/config`. So the only way to see coverage is the whole of
`npm test`, or the test files run by hand.

## Fix

Have `scripts/test-changed.mjs` pass Vitest the changed files itself
(`changedFiles` already lists them, with the shell's git) rather than
`--changed`, so Vitest never runs git. Or make the container's `/usr/bin/git`
the newer one.

## Hits

- 2026-11-18: in tmp/worktrees/staff-fixes, ran the whole `npm test` instead, ~5 min
- 2026-11-19: in tmp/worktrees/consents-redo, the same, so ran the gate's test group instead, ~3 min
- 2026-11-19: in the main checkout, ran the affected test files by hand, then the whole `npm test`, ~10 min
- 2026-11-19: in tmp/worktrees/home-photos-load, ran the gate's test group instead, ~4 min
- 2026-11-20: in tmp/worktrees/broadcast-finish-time, traced it to tinyexec's `PATH` and the old git, then ran the test files by hand, ~10 min
- 2026-11-23: in tmp/worktrees/maps-link-warning, ran the two affected test files by hand, then the gate's test group, ~3 min
- 2026-11-23: in tmp/worktrees/broadcast-tidy-ups, it exited 0 having run nothing, so it looked like a pass; ran the test files by hand, ~3 min
- 2026-11-23: in tmp/worktrees/mailing-replies-to-check, ran the affected test files by hand, ~5 min
