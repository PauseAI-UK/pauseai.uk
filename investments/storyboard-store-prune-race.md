# A picture pruned from the frame store while a review links it

Size: S. Kind: small fix.

## Problem

Every checkout shares one store of main's frames (`test-results/storyboard-frames`, `scripts/storyboard-store.mjs`), and each review prunes it (`pruneStore`). `linkFlows` checks a flow's pictures are there, then links them one by one. A picture another checkout's review prunes in between fails the link with ENOENT, and the whole of main's side is dropped: the review ends "main's side failed, so nothing is compared with it", after running every flow of main.

## Fix

`place()` in `linkFlows` treats a picture gone as the flow missing, as the check before it does, so the flow is run again and the rest are compared. Or `pruneStore` leaves any picture a tree written in the last hour refers to.

## Hits

- 2026-11-19: a full review's comparison with main was lost to it after 14 minutes of flows, and the review had to be run again
