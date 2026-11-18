# The march's highlight is drawn a little differently in a busy review

Size: S. Kind: small fix.

## Problem

In march-signup, "Sharing, and registering someone new", the frame "The form,
empty" (desktop) comes out with the orange highlight behind "Register for the
march" a pixel or two different at its rough edges from run to run of one
build: three different pictures in three full reviews. The highlight is
rough-notation's (`Marker.tsx`), with a fixed seed, so its wobble should be
the same each time; something else it's drawn from, such as the box of the
words when it's measured, differs. It hasn't happened outside a full review:
32 runs of the flow alone, 8 of them at once, all came out the same.

## Fix

Log the highlight's SVG path and the words' box before the frame, in a full
review, to see which differs between runs. Then have the mark wait for what
moves it, or measure it once that has settled.

## Hits

- 2026-11-18: differed from main in a full review of a branch that didn't touch it, and between that branch's two reviews; not reproduced in 32 runs alone, ~15 min
