# Agents edit files with the Edit tool

Size: S. Kind: tools.

## Problem

Agents here change files mostly with inline Python or `sed` run through Bash, not with Claude Code's Edit tool: over 6,000 such scripts against about 460 Edit calls, 13 October to 9 November 2026. Claude Code causes it. In auto mode, the default here, it tells the model to work through Bash and to "make small, mechanical file changes with sed, heredocs, or short scripts instead of the dedicated Read, Edit, or Write tools", and in some weeks to fall back to them only when Bash can't do the job. Sessions given the stricter wording made 92–97% of their changes by script. Failed Edits and permissions aren't the cause: Edit rarely failed and is approved automatically inside the checkout. Agents also read with `cat` and `sed -n` rather than Read, and Edit refuses a file that hasn't been Read, so one habit feeds the other.

What it costs: about 3% of the scripts fail, about a third check nothing (an `s.replace` that matches nothing writes the file unchanged and says nothing), and at least two corrupted a file. Formatting isn't the problem: Prettier rarely finds anything left.

Anthropic hasn't said why. The docs, the changelog and the post on how auto mode was built (https://www.anthropic.com/engineering/claude-code-auto-mode) don't mention it, and no one from Anthropic has answered the GitHub issues about it, which report that `/rewind` doesn't undo Bash edits and that path rules and nested CLAUDE.md files don't load (https://github.com/anthropics/claude-code/issues/87575, https://github.com/anthropics/claude-code/issues/90450). Users who read the Claude Code binary found it's an experiment behind `CLAUDE_CODE_THRIFTY_SONIC`, assigned by cohort, which would explain the two wordings (https://github.com/anthropics/claude-code/issues/88041). "Thrifty" suggests saving tokens; that's a guess. It isn't for safety: edits inside the project skip auto mode's classifier, while Bash commands go through it.

## Fix

0. Done: `.claude/settings.json` sets `CLAUDE_CODE_THRIFTY_SONIC=0`, and so do Francis's own settings. Tested on 9 November 2026: sessions with it got no Bash-first instruction, and those without it did. Undocumented, so it may stop working; a session's transcript shows whether it held (an `auto_mode` attachment means it didn't). Whether the share of script edits falls is for the next sweep to show.
1. A rule in AGENTS.md, which Claude Code ranks above its own defaults: read files with Read and change them with Edit, or Write for a new file, even in auto mode. A script only for the same mechanical change across many files, checking each replacement before writing (`assert s.count(a) == 1`), then Prettier and ESLint on what it touched. Watch a few sessions to see whether it beats the stricter wording.
2. Perhaps, if the rule doesn't hold: a project `.claude/settings.json` with a `Stop` hook that runs Prettier and ESLint on `git diff --name-only` at the end of each turn (https://code.claude.com/docs/en/hooks). A `PostToolUse` hook on Edit and Write doesn't see Bash's changes, and Bash's own list of changed files is a beta, "best effort". Whether reformatting after an Edit makes the next Edit fail with "modified since read" isn't known.

Auto mode itself can't be set from a project file (https://code.claude.com/docs/en/permission-modes, https://code.claude.com/docs/en/settings).

## Hits

- Week of 2026-10-12 (x40): sessions edited files with inline Python
- Week of 2026-10-19 (x21): sessions edited files with inline Python
- Week of 2026-10-26 (x33): sessions edited files with inline Python
- Week of 2026-11-02 (x27): sessions edited files with inline Python
