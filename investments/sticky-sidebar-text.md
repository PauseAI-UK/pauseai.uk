# The sidebar's text a pixel off between runs

Size: S. Kind: small fix.

## Problem

On desktop, a frame scrolled down a staff page sometimes draws the sticky sidebar's link text a pixel higher or lower than another run of the same build: `signup-uploads › A big file › 1` differed in two of six runs. The layout is the same each time (the same `scrollY`, every link's `getBoundingClientRect()` the same to a thousandth of a pixel, fonts loaded); only the link text moves, not the group headings or the icons. The rows sit between pixels (a group heading's `line-height: normal` is about 15.8px), but neither giving it a whole 16px nor `will-change: transform` on `.nav` stopped it (one run in four to seven still differs). So it looks like Chromium rasterising the link text a pixel one way or the other, for a reason not yet found.

## Fix

Find what makes the link text snap differently, checking each idea with seven runs of that flow (`npm run storyboard -- --no-main --no-open --desktop signup-uploads -g 'A big file'`, comparing the frame's hash): whole-pixel line heights on the links themselves, the `.page` row's centring, or Chromium's text rendering flags in the storyboard's browser. Any desktop frame scrolled with the sidebar in view can be hit, so it's a frame that differs between runs, which `AGENTS.md` says is fixed rather than retried.

## Hits

- 2026-11-10: the storyboard review of list-kit-and-letter-lifecycle showed the frame as changed against main; six reruns on one build gave two versions
