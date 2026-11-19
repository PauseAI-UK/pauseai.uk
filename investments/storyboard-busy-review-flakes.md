# Frames that differ only in a busy review

Size: S. Kind: small fix.

## Problem

Some frames come out a little differently from run to run of one build,
but only in a full review, with every worker busy. Run alone, even many at
once, they come out the same each time, so they're hard to catch.

- march-signup, "Sharing, and registering someone new", "The form, empty"
  (desktop): the orange highlight behind "Register for the march" is a
  pixel or two different at its rough edges. It's rough-notation's
  (`Marker.tsx`), with a fixed seed, so its wobble should be the same each
  time; something else it's drawn from, such as the words' box when it's
  measured, differs. Three pictures in three full reviews; 32 runs of the
  flow alone, 8 at once, all the same.
- gallery, "gallery: staff-broadcasts", "BroadcastWriter" (desktop): the
  sticky bar with the Saved pill differs faintly along its edge. A review
  with `--fresh-main` found main's kept picture and its fresh one
  different; 8 runs alone all came out the same.

## Fix

In a full review, log what each is drawn from before its frame (the
highlight's SVG path and the words' box; the sticky bar's box and
scroll), to see which differs between runs. Then have the flow wait for
it, or the frame measure it once it has settled.

## Hits

- 2026-11-18: the march highlight differed from main in a full review of a branch that didn't touch it, and between that branch's two reviews, ~15 min
- 2026-11-19: BroadcastWriter in the gallery differed from main's fresh run, after the rebase of the same branch; same picture in 8 runs of the branch alone, with and without its changes, ~15 min
