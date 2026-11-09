# Agents edit files with the Edit tool

Size: S. Kind: tools.

## Problem

Agents here change files mostly with inline Python or `sed` run through Bash, not with Claude Code's Edit tool: over 6,000 such scripts against about 460 Edit calls, 13 October to 9 November 2026. Claude Code causes it. In auto mode, the default here, it tells the model to work through Bash and to "make small, mechanical file changes with sed, heredocs, or short scripts instead of the dedicated Read, Edit, or Write tools", and in some weeks to fall back to them only when Bash can't do the job. Sessions given the stricter wording made 92–97% of their changes by script. Failed Edits and permissions aren't the cause: Edit rarely failed and is approved automatically inside the checkout. Agents also read with `cat` and `sed -n` rather than Read, and Edit refuses a file that hasn't been Read, so one habit feeds the other.

What it costs: about 3% of the scripts fail, about a third check nothing (an `s.replace` that matches nothing writes the file unchanged and says nothing), and at least two corrupted a file. Formatting isn't the problem: Prettier rarely finds anything left.

## Fix

1. A rule in AGENTS.md, which Claude Code ranks above its own defaults: read files with Read and change them with Edit, or Write for a new file, even in auto mode. A script only for the same mechanical change across many files, checking each replacement before writing (`assert s.count(a) == 1`), then Prettier and ESLint on what it touched. Watch a few sessions to see whether it beats the stricter wording.
2. Perhaps, if the rule doesn't hold: a project `.claude/settings.json` with a `Stop` hook that runs Prettier and ESLint on `git diff --name-only` at the end of each turn (https://code.claude.com/docs/en/hooks). A `PostToolUse` hook on Edit and Write doesn't see Bash's changes, and Bash's own list of changed files is a beta, "best effort". Whether reformatting after an Edit makes the next Edit fail with "modified since read" isn't known.

Auto mode itself can't be set from a project file (https://code.claude.com/docs/en/permission-modes, https://code.claude.com/docs/en/settings).

## Hits

- Week of 2026-10-12 (x40): sessions edited files with inline Python
- Week of 2026-10-19 (x21): sessions edited files with inline Python
- Week of 2026-10-26 (x33): sessions edited files with inline Python
- Week of 2026-11-02 (x27): sessions edited files with inline Python
