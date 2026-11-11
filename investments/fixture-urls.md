# Fixture pages by name, not id

Size: S. Kind: tools.

## Problem

Francis checks work on his own machine, on the default fixtures loaded into his dev database. To send him to a page ("the cancelled text broadcast", "a copy that bounced"), an agent needs the page's id. Fixture rows take their ids from sequences, so an id depends on the order of inserts in `tests/fixtures/staff-data.sql` and on what else is in his database. The agent can't see that database, so it counts rows in the SQL by hand and guesses. The storyboard doesn't help: `storyboard.json` records captions, not the address each frame shows.

## Fix

Give fixed ids, in a range of their own, to the fixture rows that pages are reached by (`OVERRIDING SYSTEM VALUE`, as letters and form entries already have). Write the list down: `npm run fixture-urls` prints each named fixture with its local path (`/staff/broadcasts/9001  the cancelled text broadcast`), read from the same seed file.

The storyboard could record each frame's path too. Then the copy page can link to the page where a placeholder shows, as well as to its picture.

## Hits

- 2026-11-09: asked for the page with the most placeholders, I counted fixture inserts to guess a broadcast's id on Francis's machine
