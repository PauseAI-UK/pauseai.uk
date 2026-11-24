# A shrunk image is resampled differently a few pixels down

Size: S. Kind: small fix.

## Problem

The determinism check (`npm run storyboard:determinism`) pictures each gallery
frame twice, the second time 3.37px further down. On the phone, the
blog-donate-events gallery's "PostCard" and "PostList" differed in that
check, but only inside a post's thumbnail, a large image drawn small. The
rest of the frame matched. It passed in the gate before, on the same code, so
the resampling depends on something other than the frame's own layout,
perhaps when the image was decoded against when it was painted.

## Fix

Find what changes the resampling: run the gallery's blog-donate-events flow
under the determinism check several times, and compare the thumbnail's
pixels when it differs. Then either make the thumbnail's drawing settle the
same way each time, or give the gallery's examples images at the size they're
shown.

## Hits

- 2026-11-17: "PostCard" and "PostList" (phone) differed in the gate's determinism check, inside the thumbnail alone, ~15 min
- 2026-11-20: "PostCard" and "PostList" (phone) differed from main in a review of a branch that touches neither, inside the thumbnail alone, ~5 min
- 2026-11-24: the November march's page (desktop) differed between runs of one build, in a small patch of its film's poster, a 1280px JPEG drawn about 550px wide and turned 1.2°; decoding the poster before the frame, and a baseline JPEG in place of the progressive one, didn't steady it, ~25 min
