# `npm run worktree`

Size: S. Kind: tools.

## Problem

Every new branch gets a worktree under `tmp/worktrees/`, which then needs `npm ci` and a free port. The storyboard's fixture server is on a fixed port, 3100 (`tests/fixture-env.mjs`), and Playwright reuses whatever answers there, so one worktree's storyboard can test another's build without saying so. `.worktreeinclude` names only `orca.yaml`, which doesn't exist.

## Fix

`npm run worktree -- <branch>` fetches, adds `tmp/worktrees/<branch>` from `origin/main`, installs, and prints the ports it will use. The fixture server's port comes from the checkout's path, and the storyboard refuses a server built from another checkout.

## Hits

- Week of 2026-10-12 (x13): sessions set up a worktree by hand
- Week of 2026-10-19 (x9): sessions set up a worktree by hand
- Week of 2026-10-26 (x10): sessions set up a worktree by hand
- Week of 2026-11-02 (x14): sessions set up a worktree by hand
- Week of 2026-10-12 (x18): sessions killed a server another checkout left on a port
- Week of 2026-10-19 (x11): sessions killed a server another checkout left on a port
- Week of 2026-10-26 (x21): sessions killed a server another checkout left on a port
- Week of 2026-11-02 (x14): sessions killed a server another checkout left on a port
