# Smaller pull requests

Size: S. Kind: ways of working.

## Problem

PRs often bundle several changes. Of the last 30 merged, the median was 22 files and about 480 added lines, #219 was +11,820 lines over 205 files, and several titles list four or more changes. A large PR fills an agent's context, takes longer to review, and collides with others in shared files.

## Fix

One visible change per PR, and about 800 changed lines at most where the work allows. A title that lists changes splits at the commas. For a large feature, the schema and library work lands first, which also settles its migrations early. The PR section of AGENTS.md says so.

## Hits

- Week of 2026-10-12 (x2): sessions ran out of context and were summarised
- Week of 2026-10-19 (x5): sessions ran out of context and were summarised
- Week of 2026-10-26 (x12): sessions ran out of context and were summarised
- Week of 2026-11-02 (x7): sessions ran out of context and were summarised
- 2026-10-21: Francis said the context was too long and asked for a handover
- 2026-10-28: Francis said the context was too long
