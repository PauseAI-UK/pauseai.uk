# Photos pictured the same in every build

Size: S. Kind: small fix.

## Problem

Two frames with photos differ between builds of the same page by a few pixels at the photos' edges, which no one can see: `/people` on a phone (a person's round photo, 6 pixels) and the collateral kit's `PhotoLibrary` in the gallery (its thumbnails, about 150 pixels). Each build pictures them the same every time, but another build of code that doesn't touch them can picture them the other way, so a review shows them as changed. Across the worktrees' runs on 14 November 2026, `/people` came out three ways and `PhotoLibrary` four, flipping back and forth along a chain of PRs that changed neither.

Which scaling Chromium uses for a downsized photo, or what Next's image optimiser hands it, may depend on what the build or the browser had done first.

## Fix

1. Find which: picture one page from two fresh builds of one commit, with the image cache cleared and kept, and compare the optimised image's bytes as well as the frame.
2. Make it the same each time: serve the image at the size it's shown, decode it before the frame (`img.decode()` in the storyboard's settling), or fix the scaling.

## Hits

- 2026-11-14: a rename-only PR's review showed `/people` (phone) and `PhotoLibrary` as changed against the base branch's run; ~20 min to show the pixels were a photo's edge, the same in two reruns of the branch's build
