# Phone numbers, tidied once

A phone number is kept as the person typed it, and tidied into
international format (`+447700900123`) every time it's used, by SQL in one
place and by several look-alike functions in TypeScript. A number that
can't be tidied is passed on as typed, and nothing says it's bad until
something outside refuses it. CiviCRM's suppression check refused a whole
batch for one such number, and held up a text to 661 people.

## Where numbers come from

On 17 November 2026:

| Source | Kept in | Numbers | Already international | International once tidied | Can't be tidied |
|---|---|---|---|---|---|
| Luma | `luma_guests.phone` | 681 | 681 | 681 | 0 |
| CiviCRM | `civicrm_contacts.phone` | 491 | 461 | 491 | 0 |
| The March form | `form_entries.phone` (`march-2026-11`) | 76 | 46 | 70 | 6 |
| Paper sign-ups (CSV) | `form_entries.phone` (`paper-signup`) | 82 | 32 | 79 | 3 |

The WhatsApp community upload (`whatsapp-community`) keeps numbers in
`form_entries.phone` too.

What each lets in:

- **The March form** (`lib/march-registration.ts`) keeps any text up to
  100 characters (`optional()`), and the person is never told their number
  can't be used.
- **Paper sign-ups** (`cleanPhone` in `lib/supporters/signup-csv.ts`) put
  back a mobile's leading 0 that a spreadsheet dropped, and keep anything
  else with enough digits as typed, `?` for an unreadable digit included.
- **The WhatsApp community upload** (`lib/supporters/signup-uploads.server.ts`)
  holds back a number it can't tidy. It's the one source that refuses one.
- **Luma and CiviCRM** give numbers people typed into their forms. CiviCRM's
  all tidy.

## Where they're tidied

`phone_number(raw)` in SQL (`netlify/database/schema.sql`) is the rule: it
strips spaces, brackets, dots and dashes, and turns `07…`, `44…`, `0044…`
and `+44 (0)…` into `+44…`, keeps `+` and a country code, and gives
anything else back as typed (`ELSE btrim(raw)`). It's called about thirty
times in the database's functions and views, and about twenty in
TypeScript:

- consent: `contact_permission()` matches every source's numbers by
  `phone_number(phone) = the number`, so text audiences, the check before
  a copy goes, and the dashboard's counts all tidy every number they read;
- matching people: supporters merged by number, form entries linked to
  supporters (`lib/supporters/records.server.ts`), and the upload's "known
  already?" (`signup-uploads.server.ts`);
- showing numbers: a supporter's page (`records.server.ts`,
  `lib/supporters/supporters.ts`) and saved filters;
- erasure: every number of someone erased, hashed into `whatsapp_erased`
  (`lib/erasure/erase.server.ts`).

The same rules, written again in TypeScript:

| Where | What it's for | How it differs from `phone_number()` |
|---|---|---|
| `phoneSearch` (`lib/server/search.server.ts`) | a search typed as a number, or part of one, in the stored form | works on part of a number; leaves `44…` without its `+` |
| `phoneWords` (`lib/phone.ts`) | a stored number as people in the UK write it, `07700 900000` | the other way round, its own UK regexes |
| `isInternational` (`lib/phone.ts`) | whether a text's number can go | the same regex as `phone_number()`'s second branch, written again |
| `cleanPhone` (`signup-csv.ts`) | a spreadsheet's dropped 0 | a rule `phone_number()` doesn't have |
| `numberOf` (`lib/broadcasts/whatsapp-stops.server.ts`) | WhatsApp's `447700…` as `+447700…` | WhatsApp's own IDs, always clean |

Nothing keeps these in step, and the search's already differs.

## What goes wrong

- **A bad number looks like a number.** `phone_number()` gives one it
  can't read back as typed, so it's matched, shown and sent on like a good
  one. Only code that knows to look (the contact preferences page's
  `LIKE '+%'`, the upload, a text's `isInternational`) catches it, each in
  its own way.
- **Nobody hears about it in time.** The person typing it isn't told, and
  staff only learn when an outside service refuses it.
- **Every query parses every number.** Matching by `phone_number(phone) =`
  can't use an index, and runs the regexes on every row each time.
- **The rules drift.** A UK number written a new way has to be taught to
  SQL and each TypeScript copy separately.

## How

In steps, each its own PR, each useful alone.

1. **One rule, tested both sides.** Keep the parsing in one TypeScript
   module (`lib/phone.ts`), and a list of cases (each typed form and what
   it should become, or that it's bad) that a test runs through both it
   and `phone_number()`, so a difference fails CI. `phoneSearch`,
   `isInternational` and `cleanPhone`'s rule use the module. `phoneWords`
   stays as display, tested on the same cases.
2. **Bad is NULL.** `phone_number()` gives NULL for a number it can't
   tidy, and so does the TypeScript. Most callers then do the right thing
   with no change: NULL matches nothing, so a bad number has no consent,
   gets no copy and merges no one. Two need care: a supporter's page shows
   the number as typed, marked as one we can't use, so staff can see it
   and fix it; and erasure finds the typed text to delete without going
   through `phone_number()`.
3. **Told at the door.** The March form checks the number as it's typed
   and says when it can't be used, as it does an email. A paper sign-up's
   row gets a problem (`SignupRowProblem`) for a number that can't be
   tidied, for the person uploading to correct or leave out. CiviCRM's and
   Luma's are theirs to fix, so a bad one stays NULL here.
4. **Kept tidied** (optional). Each source table gets a `number` column,
   the tidied number or NULL, filled as a row is written and backfilled by
   the migration that adds it, with an index. Matching and consent read
   `number`, not `phone_number(phone)`, so nothing is parsed at query
   time, and `phone_number()` is used only to fill the column. The typed
   `phone` stays beside it, as what the person gave us: it's how a staff
   member sees `0770?4225` is a misread paper form, and what goes back to
   CiviCRM or Luma unchanged.

   Keeping only the tidied number would be simpler, but loses what was
   typed for every bad one, and makes the CSV and form steps the only
   chance to fix it. Keeping both costs a column per source.

A 10-digit number starting with 7, a UK mobile without its 0, could be
tidied too, in step 1's rules. That would save three of the numbers that
can't be tidied now. Others, such as a foreign number typed without its
`+`, would need a guess at the country, so they stay bad.

## Another way: tidy numbers once, stored tidied, no `phone_number()`

Rather than tidy every number each time it's read, store each one tidied,
and let the database refuse any other.

1. **One rule, in TypeScript.** As step 1 above, but the module is the only
   rule: `phoneNumber(typed)` gives the international form or null.
   `isInternational`, `phoneSearch`'s full-number case and `cleanPhone` use
   it.
2. **Told at the door.** As step 3 above, and every other way a number
   comes in tidies it with `phoneNumber()` before it's written: the March
   form, paper sign-ups, the WhatsApp upload, and the Luma and CiviCRM
   imports. A number that can't be tidied is refused on our forms, with
   the person told, and kept as NULL from Luma and CiviCRM, whose records
   are theirs to fix.
3. **One migration cleans what's there.** Every number column
   (`form_entries.phone`, `luma_guests.phone`, `civicrm_contacts.phone`,
   `civicrm_updates.phone`, `supporter_links.matched_value` for a number)
   is set to `phone_number(column)`, and NULL where that isn't
   international. Each column gets a CHECK that it's NULL or
   `^\+[1-9][0-9]{6,14}$`, and an index where it's matched on. Every
   function and view that calls `phone_number()` is rewritten to compare
   the column itself, and `phone_number()` is dropped. The migration is
   the last thing written in its rules, as migrations are SQL alone.

What it's better at: nothing parses a number at query time; matching and
consent are plain `=` on an index; the database refuses a bad number from
any code path, including one written later; and there's one rule, in one
language.

What it costs:

- **What was typed is gone for a bad number.** `0770?4225` becomes NULL,
  so staff can't see that a paper form was misread. That's nine numbers
  today, none of them usable as they are, so dropping them loses no one
  we could text. Dropping them is data minimisation in itself: a number
  we can't use is one we needn't keep.
- **One large migration** touches the consent function, the supporter
  views, the merging by number and erasure at once, and applies to every
  query on deploy. It needs the storyboard's every flow, and a check on a
  copy of production's numbers that the counts of consents and of
  textable supporters are unchanged, but for the bad ones.
- **Every import has to tidy first,** or the CHECK fails it. A Luma or
  CiviCRM number that can't be tidied mustn't fail the whole import: it's
  kept as NULL and counted on the run's page.
- **Erasure's hashes** (`whatsapp_erased`) are of tidied numbers already,
  so they still match.

This replaces steps 2 and 4 above. Steps 1 and 3 are the same in both, so
either can start with them, and choose between step 4 and this after.

## Personal data

None of the steps collects anything new or uses numbers for anything new.

- `docs/data-protection.md`: unchanged by steps 1 to 3. Step 4 keeps a
  second form of a number we already hold, from the same sources, for the
  same uses: its rows' "Kept in" columns name the `number` columns.
- The privacy policy: unchanged.
- Erasure: step 2 makes erasure delete the typed numbers directly, not
  through `phone_number()`. Step 4 adds each source's `number` column to
  what erasure clears, and its hashing into `whatsapp_erased` reads it.
- The other way: `docs/data-protection.md` says numbers are kept tidied,
  and a bad one dropped.
