# Staff pages, unified

The staff pages' pieces are consistent, but each page assembled its own head and body from them. This makes every page one of a few kinds, each with one way to start and one layout, in three PRs. No personal data changes: nothing here adds a field, a source, a processor or a use.

## 1. Kinds of page, the head, the trail

Open as PR #304.

- Every page says its kind: list, month list, record, item, form or board.
- One head for every page but a record's, which keeps its band.
- A lesser thing's page (a letter, a one-off thread, a scheduled job, one import of sign-ups) has the same head with a line of facts.
- The breadcrumb is the whole trail, its first step the sidebar's own name for the page.
- A check that fails on a page that drifts, the style guide's "Kinds of page", and a skeleton of each kind in the gallery.

## 2. Tables

The small version: it fixes what looks broken, and leaves the tables' columns as they are.

It came from a survey: every staff page with a table, pictured in Firefox at seven window widths, from a phone's to a big monitor's, and measured for dates that break across lines and text that wraps to many lines. Nearly all that was bad had one cause: a table too wide for its window had every wrapping column squeezed to one word wide before it scrolled.

- A table too wide for its window scrolls sideways, on a phone and on a laptop alike. No column is moved or hidden to make it fit.
- A column of words keeps room for a few of them on a line, so it isn't squeezed: a name's two or three, a line's four or five (`ListColumn`'s `words`). Politicians, Events, Sent emails, the audit log, Errors, the one-off threads and the blocked addresses say which of their columns are which. Correspondence doesn't: it fits a laptop as it is, and with room kept for its names its topic had less.
- A row's buttons stay at the window's right edge while its table scrolls under them, except on a phone.
- A date never breaks across lines, nor a time with it: a column of dates is a short one, and a date among other words in a cell is a `When`.
- Long text in a cell is cut short, with a small "…" pill after it that unfolds the whole of it in place, as a bounce's reason does. The pill is one shared piece, `Shortened`. Sent emails' subject is cut at a word, at 40 characters. The list keeps its eight columns and their sorts. No other column needed it once the columns of words had their room.
- On both pages of blocked addresses, the reason for unblocking moves out of the row. The row has a button, "Unblock…", which opens a bubble that asks why, as Edit does for an account's permissions. A politician's own page keeps its field, as it isn't a row of a table.
- The storyboard fails on it: on the desktop, every frame of a staff page fails its flow if a date in one of the page's tables is on two lines. One shared helper, described in `docs/testing.md`. It doesn't check a table's width, as a wide table scrolling sideways is right.

## 3. Cards, empty states, the erase form, the sidebar

Builds on the first PR.

- Every box a card: Events by owner and by tag, a supporter's sections, an error's message and stack trace, Your account. The shared piece is what goes in the card: a list of rows, each a main line, a grey second line and something at its right.
- A supporter's page flipped, so the main thing is on the left, as on a politician's.
- One way to say there's nothing, and a filtered list that finds nobody keeps its frame.
- Erase in a card, with what's erased and what's kept beside it.
- The sidebar's two "Blocked emails" links are renamed: "Bounces and complaints" under Supporters, "Addresses to fix" under Politicians. They stay two pages, as different staff see each and the politicians' one is the more important.
  - The two pages' titles ("Supporters' blocked emails", "Politicians' blocked emails") change to match their links.
  - The line under both titles, "Nothing is sent to these addresses until they're unblocked", is shared and written for the old name. It's rewritten too, one line for each page, saying what that page is: the supporters' a list of bounces and complaints, the politicians' a list of addresses to fix. A person writes them.
  - Anything else that names the pages is rewritten with them: the link "See blocked emails" on a supporter's page, the dashboard's line about an MP's bouncing address, and any other copy that says "blocked emails" meaning one of these pages.

## Left out

Decided against: the band on lesser pages; folding a mailing's email above its recipients; one row for the lists by month; Scheduled jobs as a status list.

From the tables, decided against:

- Lesser columns going under the first column as a grey second line when a list is too wide. It takes away the headings that sort by them, and only Politicians needs it.
- Redrawing Politicians, or Sent emails as five columns. A list wider than a laptop's window scrolls sideways.
- The audit log's Date and When as one column, and a count row on Staff accounts. Both are cosmetic, and only admins see them.
