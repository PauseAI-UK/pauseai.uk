# Deleting a picture pictures every flow

Size: S. Kind: small fixes.

## Problem

When a branch adds or deletes a file, `reachedFlows()` in `scripts/storyboard-reach.mjs` also reaches the files that list its folder (`listers()`). It takes a file to list a folder if the file calls `readdir` and names any one of the path's folders on its own, such as `"people"` or `/people/${`. So deleting a photo from `public/images/people/` counts `app/sitemap.ts` as one of its listers: the sitemap walks `app/` and builds `/people/${slug}` addresses, but never lists `public/`. As every flow's reach holds the sitemap, a review of a branch that deletes one photo pictures every flow, 763 of them.

## Fix

Have `listers()` match a folder's whole path from the checkout's root, such as `public/images/people` or the `app` that the sitemap joins to its folder, rather than any one folder name in it. Then a file under `public/` reaches only what lists `public/`.

## Hits

- 2026-11-25: deleting two staff photos made the review plan every flow; worked out why with a script in tmp/ and ran a narrow review by hand, ~15 min
