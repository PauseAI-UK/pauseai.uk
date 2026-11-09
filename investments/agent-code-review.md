# An agent reviews each PR's code

Size: S. Kind: ways of working.

## Problem

Nobody reads the code in a PR: Francis reviews the result (frames, a served copy, the copy), and CI checks types, tests and lint. Problems in the design go unseen until they cost something: the architecture review on 9 November found a letter could be left stuck in `sending` for good, and a test table missing from the list that empties them.

## Fix

Before a PR is marked ready, an agent other than its author reviews its code (Claude Code's `/code-review`, https://docs.claude.com/en/docs/claude-code), fixes what's clearly wrong, and adds anything bigger to `investments/`. AGENTS.md says so, among the steps before marking a PR ready.

## Hits

- 2026-11-09: a review of the code found letters can stick in `sending` and `job_presses` missing from the tests' table list, both in merged code
