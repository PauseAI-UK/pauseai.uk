# The build fetches its fonts from Google

Size: S. Kind: small fix.

## Problem

`app/layout.tsx` loads Lato with `next/font/google`, so every `next build` fetches it from fonts.googleapis.com. When that request fails, the build fails, and with it every flow of a storyboard review, which then reports every frame as changed. Nothing in the change being reviewed caused it, and the same request works a minute later.

## Fix

Self-host the fonts with `next/font/local`, keeping the files in the repo, so a build needs no network for them.

## Hits

- 2026-11-13: a storyboard review's build couldn't fetch Lato from Google Fonts, so all 620 flows failed and 2,116 frames showed as changed; the request worked straight after, ~10 min
