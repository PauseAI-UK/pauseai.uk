# One PR at a time

Size: S. Kind: ways of working.

## Problem

When several PRs are open at once, each merge forces the others to rebase, run CI again and change their storyboard frames, so Francis looks again; two can take the same migration number; and an agent juggling them loses track. Francis finds one PR per piece of work quickest to review, as each needs a gate run, a served copy and its copy found, and a "master agent" fanning work out to several PRs at once made it worse.

## Fix

One PR per piece of work, however many changes it holds, and one open at a time unless two touch nothing in common. No agent coordinating several PRs in parallel. AGENTS.md's PR section says so.

## Hits

- 2026-11-07: one agent ran seven PRs at once through subagents over 18 hours; rebases, force pushes, a migration number collision (CI run 42421736068), a compaction, and the chat lost for a while
- Week of 2026-10-12 (x2): sessions ran out of context and were summarised
- Week of 2026-10-19 (x5): sessions ran out of context and were summarised
- Week of 2026-10-26 (x12): sessions ran out of context and were summarised
- Week of 2026-11-02 (x7): sessions ran out of context and were summarised
