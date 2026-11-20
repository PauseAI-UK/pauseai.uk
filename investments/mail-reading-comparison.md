# Compare two readings of mail across the kept messages

Size: M. Kind: tools.

## Problem

How a message is read (`lib/email-parsing/`) is tested on made-up messages, each written for the case it tests. A change to it changes the text of every kept message on the staff pages at once, and only real mail shows what else it changes: Outlook's, Word's and Apple Mail's HTML, Gmail's quoting, casework systems, signatures. Seeing that takes a scratch script in `tmp/` that reads the kept messages both ways, as main and the branch read them, and sorts the differences. Nothing in the repo does it, so each change to reading mail either writes one again or goes without.

## Fix

A script, run by hand, that reads the kept messages into `tmp/` (read-only, deleted after), reads each with main's code and the branch's, and writes a page to `tmp/` listing the staff pages whose text changes, grouped by what changed, each with its before and after. It keeps nothing private in the repo.

## Hits

- 2026-11-20: a change to read mail from its HTML was checked across the kept messages with a scratch harness in `tmp/`: fetching, reading both ways, sorting the differences and a report page, ~3 h
