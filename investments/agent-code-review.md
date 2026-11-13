# An agent reviews each PR's code

Size: S. Kind: ways of working.

## Problem

Nobody reads the code in a PR: Francis reviews the result (frames, a served copy, the copy), and CI checks types, tests and lint. So problems in the design go unseen until they cost something. The architecture review on 9 November found two: a letter could be left stuck in `sending` for good, and a table was missing from the list of tables the tests empty.

## Fix

Before a PR is marked ready, an agent other than its author reviews its code (Claude Code's `/code-review`, https://docs.claude.com/en/docs/claude-code), fixes what's clearly wrong, and adds anything bigger to `investments/`. AGENTS.md says so, among the steps before marking a PR ready.

## Hits

- 2026-11-09: a review of the code found letters can stick in `sending` and `job_presses` missing from the tests' table list, both in merged code
- 2026-11-13: a review of the broadcasts PR, the day it merged, found six bugs in sending them, among them one where a Gmail quota error would have failed every recipient; fixed in a PR of their own
