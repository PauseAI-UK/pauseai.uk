# Serve the checkout you're in, on the fake data

Size: S. Kind: tools.

## Problem

`npm run serve` serves a branch from a worktree, never the main checkout, and the storyboard's server has a fixed clock and an empty database for each flow. So there's no way to click round, or drive a browser over, the branch checked out in the main checkout on the dev fake data (`tests/fixtures/staff-data.sql`) with the clock running, short of the person's own dev server. A fault that depends on the data or the date, rather than on one flow, can't be looked for.

## Fix

A flag for `scripts/serve-fixture.mjs`, or a script beside it, that serves the checkout's last fixture build on a fresh database with the fake data and no `FIXTURE_NOW`, on a port of its own, and prints the address. The build's own origin is baked in (`FIXTURE_ORIGIN`), so its redirects must go to the port it's served on.

## Hits

- 2026-11-19: wrote a script in tmp/ to serve the storyboard's build on the fake data with the real clock, and two more to try every choice of a form for every fake supporter in Firefox, ~30 min
