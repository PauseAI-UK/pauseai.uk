# The friction sweep

Size: S. Kind: tools.

## Problem

The monthly review needs counts of what agents keep doing, from their session logs. Those logs hold private data and stay on Francis's machine. The counts in this folder came from a one-off script.

## Fix

A script that reads the session logs locally and writes only counts to `tmp/`, by week: repeated environment setup, gate runs, worktree setup, servers killed, coverage and storyboard scripts, rebase conflicts by file, and sessions that ran out of context. It quotes nothing from the logs. The monthly review adds its counts here as hits.

## Hits

None yet.
