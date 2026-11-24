# workingTree() missed an edit in CI

Size: S. Kind: small fix.

## Problem

`scripts/fixture-server.test.ts`, "workingTree changes with an edit, uncommitted or untracked", failed once in CI: after a same-size edit (`one` to `two`) straight after a commit, `workingTree()` (`scripts/fixture-server.mjs`) gave the committed tree, as if nothing had changed. It hashes the checkout with a copy of its index, so Git reads only the files whose stat has changed, and a copy has its own modification time, which Git's same-second ("racy") check reads. That's the likely way in, but not shown: here, with Git 2.56, the edit was seen in 40 straight runs, and with the times set by hand so that Git trusts the old entry. CI's image has Ubuntu 24.04's Git, 2.43, on a different filesystem. If it's real, the storyboard can reuse a fixture server built before a quick edit.

## Fix

Reproduce it in CI's image (`ghcr.io/pauseai-uk/ci`), running the test in a loop. Then either give the index's copy the original's modification time, so Git's check works on it as on the index, or start the copy from `git read-tree HEAD`, with no stat to trust: every file hashed, about 0.6 seconds for this checkout against 0.03.

## Hits

- 2026-11-24: failed Test (3 of 3) on #486, a PR that didn't touch it; ~20 min trying to reproduce it
