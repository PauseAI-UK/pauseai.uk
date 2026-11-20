# Main's frames carried from another tree, but none in the review

Size: S. Kind: small fix.

## Problem

When main has moved and the store has no frames for its new tree, a review carries main's frames from the nearest kept tree (`carryFromNearest()` in `scripts/storyboard.mjs`) and says how many flows it carried. That run's `main/frames.json` can still hold no frames, so every flow shows as one main is missing and nothing is compared. The same review run again straight after, with nothing to run, reads the carried frames from the store and compares them.

## Fix

Find why the run that carries them doesn't read them back: `mainFromStore()` may return the `kept` it read before carrying, rather than reading the tree again. Then a review that carries main's frames compares with them the first time.

## Hits

- 2026-11-13: after a rebase onto a new main, a review of every flow said it carried main's frames of 622 flows, then had main missing for all 618; a second run compared them, ~10 min
- 2026-11-20: the same after a rebase onto a new main: every flow ran, main's frames of 672 flows were carried, and all 676 had main missing till the review was run again
