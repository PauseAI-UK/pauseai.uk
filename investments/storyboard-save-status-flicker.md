# A frame catches a draft's save status as it changes

Size: S. Kind: tools.

## Problem

The broadcast writer's save status, at the top right of a draft, shows "Saving" while a change goes to the server and "Saved" once it's there. A frame taken while it's changing catches either, so the same frame differs between two runs of the same code: "An email asking readers to write to their MP", frame 1, showed "Saving" on one run and "Saved" on the other.

## Fix

Have the storyboard's settling (`tests/storyboard/settle.ts`) wait until no save is going before a frame, as it waits for the page to be at rest.

## Hits

- 2026-11-28: differed from main in a review of a branch that changes nothing on that page, both viewports
