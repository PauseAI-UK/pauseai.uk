# Agents can't push a change to CI's workflow

Size: S. Kind: ways of working.

## Problem

GitHub refuses a push that changes a file in `.github/workflows/` from a token without the `workflow` scope, and the token agents push with doesn't have it. So an agent can't add a step to CI or change one. The refusal comes at the first push, after the work is done, and the docs don't mention it.

## Fix

Either give the token the `workflow` scope, or say in AGENTS.md that a change to a workflow is committed and left for a maintainer to push.

## Hits

- 2026-11-12: a new CI step was refused at the push; the check went into an npm script CI already runs, then back into the workflow for a maintainer to push, ~30 min
- 2026-11-24: CI choosing a pull request's flows from main's record needed a workflow change, so the branch was left for a maintainer to push
- 2026-11-24: main's Storyboard parts failed on Git's "dubious ownership" for five merges; the one-step fix was left for a maintainer to push
