# The broadcast writer's template test misses its choice

Size: S. Kind: small fix.

## Problem

In `app/(staff)/staff/_components/broadcasts/BroadcastWriter.browser.test.tsx`, "deletes a template nothing else has, quietly, letting this draft's choice go first" can time out in CI on its second `pick()`. Playwright's log shows the template list moving under the press: another template took it, then the preview card beside the list did, which closed the list, and the choice was never visible again. It passed eight times out of eight run alone, with a storyboard running beside it.

## Fix

Choose in `pick()` (both copies in the file) without a pointer press that the list's movement can redirect: wait for the choice to be visible, focus it and press Enter. Or find what still moves the dropdown after the chosen template's heading shows, and wait for that.

## Hits

- 2026-11-26: failed Test (1 of 3) on a PR that didn't touch broadcasts, ~20 min
