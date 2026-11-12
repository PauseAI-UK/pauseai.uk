# The gate's flows and the full review run the same flows twice

Size: M. Kind: tools.

## Problem

Before a branch is done it gets two runs of the storyboard, one after the other, as they can't share a checkout:

- **The gate's flows** (`npm run test:storyboard`): every flow on desktop, and on the phone only those tagged for it, with no pictures. 305 flows, about 3.5 minutes here.
- **The full review** (`npm run storyboard`): every flow on both viewports, with a picture of each frame, set beside main's. 566 flows, about 7 minutes here.

The review runs every flow the gate does, and more, so on the same code the gate's run proves nothing the review hasn't. Each also builds the site unless a server is already up. A session that changes something small near the end pays for both again: about ten minutes, most of it repeated.

The two aren't the same thing, though, and what follows from the overlap depends on differences that haven't been looked at closely:

- Whether a flow does anything different when it takes pictures (`STORYBOARD_SHOTS`), such as waiting for a page to settle, so that one kind of run could pass where the other fails.
- The review never fails on a difference from main, only on a flow that fails. Its exit code and the gate's mean the same only for the flows.
- CI runs the flows, in three shards, and never the review. Whatever the gate skips here, CI still runs.
- A review can reuse a server that's already up, whose build may not be of the code as it is now. A run only counts for a tree if Playwright built that tree for it, as the frames' store already checks.
- Both record the commit they ran on (`docs/testing.md`, "The gate's status" and "The storyboard's progress"), not the tree. Uncommitted edits don't reset them, and a commit that changes no code, such as one to a doc, does.

## Fix

Work out the differences above first. Then, from the least change to the most:

1. **Record the tree, not the commit.** The frames' store already hashes the working tree (`scripts/storyboard-store.mjs`). With the tree in the gate's status and the review's record, "has this code passed" is right for uncommitted edits too. Deciding which files can change a flow (not `docs/`, `investments/` or `plans/`) would stop a doc's commit asking for both runs again.
2. **One build for both.** When the gate's flows and a review follow each other on the same tree, the second reuses the first's build, or its server.
3. **The gate takes a passed review as its flows.** If a full review has passed on this tree, the gate marks its storyboard as passed and doesn't run it. The status line already shows it so.
4. **The gate can run the review.** `npm run gate -- --review` runs the review in place of the flows: one run, with pictures, that counts for both.
5. **Rerun less after a fix.** After a change to one area, run only the flows that failed or that the changed files can reach, and carry the rest, as a partial review carries frames now. This needs a map from files to flows, and is the largest of these.

## Hits

- 2026-11-12 (x4): ran the gate and then the full review on the same commit of one branch, the same flows twice, ~3.5 min each time
- 2026-11-12: a commit of one doc reset both marks, so the gate and the review were both due again for no change to the code
