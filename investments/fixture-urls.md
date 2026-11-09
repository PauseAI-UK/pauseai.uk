# Fixture pages by name, not id

Size: S. Kind: tools.

## Problem

Francis checks work on his own machine, on the default fixtures loaded into his dev database. To send him to a page ("the cancelled text broadcast", "a copy that bounced"), an agent needs its id, and fixture rows take theirs from sequences, so the id depends on the order of inserts in `tests/fixtures/staff-data.sql` and on what else is in his database. The agent can't see that database, so it counts rows in the SQL by hand and guesses, and the storyboard doesn't help: `storyboard.json` records captions, not the address each frame shows.

## Fix

Give fixture rows that pages are reached by fixed ids (`OVERRIDING SYSTEM VALUE`, as letters and form entries already have), in a range of their own, and write the list down: `npm run fixture-urls` prints each named fixture with its local path (`/staff/broadcasts/9001  the cancelled text broadcast`), from the same seed file. The storyboard could record each frame's path too, so the copy page can link the page where a placeholder shows, as well as its picture.

## Hits

- 2026-11-09: asked for the page with the most placeholders, I counted fixture inserts to guess a broadcast's id on Francis's machine
