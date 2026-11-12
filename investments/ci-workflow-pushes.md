# Agents can't push a change to CI's workflow

Size: S. Kind: ways of working.

## Problem

GitHub refuses a push that changes a file in `.github/workflows/` from a token without the `workflow` scope, and the token agents push with doesn't have it. So an agent can't add a step to CI or change one. The refusal comes at the first push, after the work is done, and the docs don't mention it.

`npm run lint` ends with `npm run placeholders` for this reason: the placeholder check would otherwise be a step of its own in the "Lint, format" job.

## Fix

Either give the token the `workflow` scope, or say in AGENTS.md that a change to a workflow goes to Francis as a diff to push himself. With the first, the placeholder check can become its own step of the lint job, and `npm run lint` goes back to ESLint alone.

## Hits

- 2026-11-12: a new CI step was refused at the push; the check went into an npm script CI already runs, ~10 min
