# The copy waiting for approval

Size: M. Kind: tools.

## Problem

Francis approves each ⁂ placeholder before it becomes real copy, so for each PR he asks what copy there is and where it shows. Agents answer by grepping and describing, and he then finds each piece on the page.

## Fix

`npm run copy` writes one HTML page to open and review. For each placeholder the branch adds or changes, it shows the copy as written, its file and line number, and the storyboard frames where it appears, each cropped around it with the text boxed. Placeholders found in no frame are listed together at the end, as each needs a flow or can't be reached.

Linking copy to frames uses ⁂ as the marker, since nothing else on the site contains it:

1. At each frame, the storyboard records every visible piece of text containing ⁂, and where it is on the page, alongside the screenshot.
2. The script finds the lines that add or change a ⁂ since `origin/main`.
3. It matches them: plain strings exactly, and template copy (`` `⁂ ${n} letters to ${name}` ``) as a pattern, each `${…}` matching anything.

Copy sent only in emails is matched against the emails the storyboard frames from the outbox, and listed as not seen otherwise. Two placeholders with the same text are shown together.

## Hits

- Week of 2026-10-12 (x6): Francis asked to see the copy waiting for approval in a PR
- Week of 2026-10-19 (x7): Francis asked to see the copy waiting for approval in a PR
- Week of 2026-10-26 (x14): Francis asked to see the copy waiting for approval in a PR
- Week of 2026-11-02 (x27): Francis asked to see the copy waiting for approval in a PR
