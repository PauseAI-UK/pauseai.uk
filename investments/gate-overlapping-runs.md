# Two gates in one checkout crash the first

Size: S. Kind: small fix.

## Problem

`npm run gate -- --only <group>` started while a full gate runs in the same checkout clears `tmp/gate/`'s logs. The full gate's once-a-minute status line (`heartbeat` in `scripts/gate.mjs`) then stats a log that's gone, and the gate crashes with ENOENT, its other groups' results lost. Nothing warns that another gate is running.

## Fix

Have the gate take a lock in `tmp/gate/` while it runs, and refuse to start beside another, naming the running one's PID. Have the heartbeat treat a missing log as quiet rather than throwing.

## Hits

- 2026-11-25: reran the tests with `--only test` while a full gate ran, which crashed it, ~10 min
