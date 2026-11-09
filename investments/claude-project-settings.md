# Project settings for Claude Code

Size: S. Kind: tools.

## Problem

The repo has no `.claude/settings.json`. Agents edit files mostly with inline Python rather than the Edit tool (over 7,000 such scripts, against 462 Edit calls), so formatting and linting happen only when they think to run them. Why they prefer Python here isn't known.

## Fix

Find out why first. Then perhaps a project settings file with a hook that runs Prettier and ESLint on edited files, and an allow list for the read-only commands agents run most (https://docs.claude.com/en/docs/claude-code/hooks, https://docs.claude.com/en/docs/claude-code/settings).

## Hits

- Week of 2026-10-12 (x40): sessions edited files with inline Python
- Week of 2026-10-19 (x21): sessions edited files with inline Python
- Week of 2026-10-26 (x33): sessions edited files with inline Python
- Week of 2026-11-02 (x27): sessions edited files with inline Python
