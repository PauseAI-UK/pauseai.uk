# Smooth scrolling in flows lands by timing

Size: S. Kind: small fix.

## Problem

`styles/base.css` sets `scroll-behavior: smooth` for anyone who hasn't asked
for reduced motion, and the storyboard's browsers don't ask. So a scroll a
flow causes, such as typing into an editor that keeps its cursor in view,
animates over many frames, and on a busy machine a later scroll can start
before an earlier one ends. Where the page comes to rest then depends on
timing, and the frame after it differs from run to run of one build. Each
flow that hits it gets its own wait and scroll before its frame.

## Fix

Run the storyboard's browsers with `reducedMotion: "reduce"` in
`playwright.config.ts`, so every scroll is instant, and drop the waits that
flows have for smooth scrolls. Every frame scrolled by a flow may move once.

## Hits

- 2026-11-16: "A reply to a text" (phone) differed from main's in a full gate's review by a few pixels of scroll, after typing an answer, ~30 min
