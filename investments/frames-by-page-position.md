# Gallery frames that change with what's above them

Size: S. Kind: small fix.

## Problem

On the phone, a gallery section's frame can differ by a few pixels of antialiasing (a channel by 5 or 6 of 255) when a section above it grows or shrinks, though the section itself is the same. So a change to one component's example shows unrelated frames as changed further down its group, which a reviewer must check by eye or by script.

## Fix

Find what makes text raster differently at another place on the page (a fractional offset from a wrapped line's height, or the scroll before the picture), and picture each section the same way wherever it is: by scrolling it to the top of the window, or by rounding the offset it's drawn at.

## Hits

- 2026-11-14: the oversight feature-folders PR moved components whose path lines wrap on the phone, and 19 phone frames of unchanged components further down their groups differed by antialiasing alone; checked with a pixel diff script in tmp/
