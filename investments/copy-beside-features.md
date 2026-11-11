# Copy beside its feature

Size: L. Kind: architecture.

## Problem

All the staff interface's words are in one object in `lib/content/staff-interface.ts`: about 2,900 lines and 140 KB, referenced by over 300 files and changed in nearly 400 commits since October. It mixes three kinds of text: UI labels, email bodies such as `loginEmail.body`, and server problem and log messages, imported by about 40 files under `lib/server/`, tests aside. About 30 client components import it, and a bundler can't drop the unused parts of one object, so most of it probably ships to staff browsers (not yet measured). Reading a component means following keys like `copy.byKind[kind].title` into a file far away.

`docs/code-structure.md`, "Where the words go", gives three reasons for one file: words can change without touching code, tests refer to text by name, and placeholders can be found. Only the second still pays: the same person changes words and code in the same PR, and the placeholder check scans the whole repo wherever copy lives.

## Fix

Each feature gets a `copy.ts` beside its components, which its tests import as they import `staffCopy` today. A small shared vocabulary (statuses, houses, fields, paging) stays central. Emails and problem messages move beside the server code that sends them. Move one top-level key at a time, the most used first (`politician`, `mailingPages`, `letters`), and change the rule in `docs/code-structure.md` to "a feature's words are in its `copy.ts`". Plurals go through `plural()` and `count()` in `lib/content/plural.ts`.

## Hits

None yet.
