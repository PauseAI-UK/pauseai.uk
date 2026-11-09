# `npm run serve` for any branch

Size: M. Kind: tools.

## Problem

Francis reviews a PR by using it: clicking around a running copy on fixture data, logged in as staff, from his Mac. Getting one is a procedure an agent rebuilds each time from its notes: `next dev` in the branch's worktree with the fixture environment and a fresh database with fixture data, a seeded staff account, and a small proxy in front of it, because the session cookie is `Secure` and the browser drops it over plain http. The proxy is kept outside the repo, and the link has to use the container's IP, which changes.

## Fix

`npm run serve -- [branch or PR number]` makes or reuses that branch's worktree, starts the fixture server and the proxy on a free pair of ports, checks the page loads through the container's IP, and prints the link to open on the Mac. It keeps running until stopped, one per branch at a time, and `--stop` stops it. The proxy is in `scripts/`, fixture-only. Then AGENTS.md says "serve it" means this.

## Hits

- Week of 2026-10-12 (x1): Francis asked for a branch to be served on a port
- Week of 2026-11-02 (x10): Francis asked for a branch to be served on a port
- 2026-11-07: a served branch wouldn't open in Firefox; it took a detour through its proxy settings to find out why
