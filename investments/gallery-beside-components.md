# Gallery examples beside their components

Size: M. Kind: architecture.

## Problem

The gallery's examples are in a few big files by area under `app/(tools)/gallery/_examples/`: `staff-admin.tsx` is 1,231 lines, `staff-kit.tsx` 1,137, `staff.client.tsx` 1,092. A staff change edits a large shared file far from its component, and these files were touched in 209 commits since October. Example data already sits beside components, in 19 `*.examples.ts` files.

## Fix

A `Component.gallery.tsx` beside each component. The gallery pages collect them, and `tests/checks/gallery.test.ts` checks each component has one. Move each area when it's next worked on.

## Hits

None yet.
