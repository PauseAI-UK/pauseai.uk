# Main's frames that aren't main's build

Size: S. Kind: small fix.

## Problem

A review's "main" frame can show what main's code doesn't have, so the
frame shows as different though the branch didn't change it. On
`three-things` (from `4bf92c0e`), the gallery's Tag example on a phone
differed by 14% of pixels: main's frame had a "Grey" tag that
`components/ui/Tag.tsx` has on neither main nor the branch. The frame
main's side carried must have come from another checkout's build, kept
under main's tree.

## Fix

Find how `scripts/storyboard` decides which kept frames are main's own
(`docs/testing.md`, "Main's frames are main's own"), and key them by
something that changes with every file a flow reaches, not just main's
tree; or record with each kept frame the commit it was built from, and
refuse one that isn't main's.

## Hits

- 2026-11-13: a Tag frame on `three-things` showed a change the branch didn't make, ~5 min finding that main's side was wrong
