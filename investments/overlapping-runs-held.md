# Overlapping runs held open in tests

Size: S. Kind: small fix.

## Problem

`atOnce()` (`tests/at-once.ts`) starts several runs of a job together to show only one goes, but nothing keeps the first going until the others have tried: on a slow machine one waits for a pool connection until the first has finished, takes the job itself and goes too. `gmail-reading.test.ts` holds its run at Gmail until the others are turned away; `luma-import.test.ts` and `sending-job.test.ts` don't yet.

## Fix

Give `atOnce()` a hold: the copy that takes the claim waits on a promise that the others release as they're turned away, as the Gmail test does by hand, and use it in all three.

## Hits

- 2026-11-10: the Gmail overlap test failed once in the gate (two runs went), passed on its own
