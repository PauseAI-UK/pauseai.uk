# A new march in one place

Size: M. Kind: architecture.

## Problem

Adding the next march takes the same edit in many places, because each march's sign-up is a form of its own, named for its month (`march-2026-11`, `march-2027-04`), and the form's name is listed by hand wherever forms are:

- the `form_entries` check, in a migration;
- `EntryForm`, `SUPPORTER_SOURCES` and `MARCH_SOURCES`;
- five maps of words by form, in `lib/content/email-settings.ts` and `lib/supporters/copy.ts`;
- `MARCH_EVENT_ID` and `MARCH_FORM` in `lib/events/march.server.ts`;
- its facts in `lib/content/march.ts`, a page folder, the link preview's pictures and `scripts/march-preview.mjs`;
- the docs that name the form or the page's address.

The words by form are `Record<string, string>`, so a form left out of one isn't a type error: its words are just missing on the page.

## Fix

Keep the marches as rows of one list in `lib/content/march.ts`, each with its form, Luma event and page, and make the rest from it: the sources and the words by form, the page (one route with the march's slug), the preview script's address and folder. Type the words by form as `Record<SupporterSource, string>`, so a missing one fails `tsc`. The migration stays by hand.

## Hits

- 2026-11-23: adding the April 2027 march meant the form's name in 12 files and a migration, ~1 hour
