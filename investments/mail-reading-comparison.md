# Compare two readings of mail across the kept messages

Size: M. Kind: tools.

## Problem

How a message is read (`lib/email-parsing/`) is tested on made-up messages, each written for the case it tests. A change to it changes the text of every kept message on the staff pages at once, and only real mail shows what else it changes: Outlook's, Word's and Apple Mail's HTML, Gmail's quoting, casework systems, signatures. Seeing that takes a scratch script in `tmp/` that reads the kept messages both ways, as main and the branch read them, and sorts the differences. Nothing in the repo does it, so each change to reading mail either writes one again or goes without. And the reading code imports `server-only` and `@/` paths, so a plain script in `tmp/` can't run it. Copying the script into `lib/` as a Vitest test clashes with a gate running in the same checkout, whose tests, linters and coverage pick it up. A Vitest config of its own in `tmp/`, mapping `@/` to the repo and `server-only` to an empty module, runs it from there beside the gate, but that has to be found each time.

## Fix

A script, run by hand, that reads the kept messages into `tmp/` (read-only), reads each with main's code and the branch's, and writes a page to `tmp/` with each changed message in three columns: the sender's HTML, main's reading and the branch's, drawn as the staff page draws them. It runs the reading code from outside `lib/`, through a Vitest config of its own, so it runs beside the gate. It keeps nothing private in the repo.

## Hits

- 2026-11-20: a change to read mail from its HTML was checked across the kept messages with a scratch harness in `tmp/`: fetching, reading both ways, sorting the differences and a report page, ~3 h
- 2026-11-23: refetched the mail, rewrote the harness for a three-column examples page, then waited ~5 min on the gate's tests to copy it into `lib/`, before finding a Vitest config in `tmp/` that runs it beside the gate
