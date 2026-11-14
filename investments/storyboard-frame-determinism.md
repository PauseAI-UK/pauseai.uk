# Frames that depend on where they're drawn

Size: S. Kind: tools.

## Problem

A frame can depend on more than what it shows: on the fraction of a pixel
the content above left it at, or on what Chromium drew before. Nothing
checks for that, so it's found only when a branch's frame differs from
main's by a few pixels that nobody changed, and someone spends an hour
finding out why. `tests/storyboard/frame.ts` (`alone`, `repaint`) handles
the causes found so far; a new one would go unseen the same way.

## Fix

A check that pictures each gallery group twice, the second time with a
sliver of a pixel and a few whole pixels of space put above its first
component, and fails if any frame differs. Run it when `frame.ts` or
`playwright.config.ts` changes, and now and then on main.

## Hits

- 2026-11-14: gallery frames on a phone differed from main's at a pill's edge, with nothing in them changed; ~4 hours finding three causes (a fraction of a pixel above, a fixed bar's stale raster, photos and gradients drawn differently at each place on the page), with scripts in tmp/ that put a spacer above a component and compared the pictures
