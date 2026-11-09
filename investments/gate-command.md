# `npm run gate`

Size: S. Kind: tools.

## Problem

The CI gate is a procedure in AGENTS.md, not a command. Each agent writes its own script to run the fast checks on the changed files, then the slow ones in parallel with time limits, and to collect the exit codes. Francis often wants only the fast checks while making UI changes.

## Fix

`npm run gate` does what AGENTS.md describes: the fast checks on the files changed since `origin/main`, then the CI commands in parallel, each with a time limit and a log in `tmp/gate/`, ending with each command's exit code. `npm run gate -- --fast` stops after the fast checks. AGENTS.md then names the command instead of listing the steps.

## Hits

- Week of 2026-10-12 (x16): sessions ran the gate with their own script or chain of commands
- Week of 2026-10-19 (x18): sessions ran the gate with their own script or chain of commands
- Week of 2026-10-26 (x23): sessions ran the gate with their own script or chain of commands
- Week of 2026-11-02 (x14): sessions ran the gate with their own script or chain of commands
