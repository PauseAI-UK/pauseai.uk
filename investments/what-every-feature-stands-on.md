# What every feature stands on, placed honestly

Size: M. Kind: architecture.

## Problem

The top of `lib/` and `lib/server/` are meant to hold only what every feature stands on, below every feature (`docs/code-structure.md`, "What every feature stands on"). Some of what sits there doesn't fit that.

The staff lists' machinery imports from almost every feature:

- `lib/staff-search.ts`, each list's parser, reads filter values from `email`, `events`, `letters`, `oversight`, `politicians` and `supporters`.
- `lib/staff-list-filters.ts`, each list's filter bar, reads them from `asks`, `events`, `letters`, `oversight`, `politicians` and `supporters`.
- `lib/staff-forms.ts` reads `accounts`' permissions and `asks`.
- `lib/server/stored-filters.server.ts`, the saved filters, reads `asks`, `events`, `oversight`, `politicians` and `supporters`.

So it works as a registry above the features, though it sits below them. Each list uses it, and it uses each list's feature, so a change to one feature's filter values reaches every list's page. ESLint doesn't hold it: `FEATURES` in `eslint.config.mjs` leaves `lib/`'s top-level files and `lib/server/` open to every feature and limits nothing they import. Only `tests/checks/import-cycles.test.ts` stops a feature's module that it reads from importing it back.

The same goes for a few files in `lib/server/`, which is meant to be infrastructure only:

- `lib/server/outside-services/parliament.server.ts` and `postcodes.server.ts` import politicians' pure code (parsing a body's list of members, constituencies' names).
- `lib/server/import-runs.server.ts` uses the sending layer, `lib/email/`, to email staff about a failed run.

`lib/controlai-letter.ts` and `lib/controlai-statement.ts` sit at the top of `lib/`, though they're neither shared machinery nor small helpers: they're pure parsers of ControlAI's two pages, the PM letter's signatories and the statement page's profile links. The ControlAI binding (`lib/server/outside-services/controlai.server.ts`), the import log (`lib/import-runs.ts`), politicians' `lib/politicians/official-profiles.ts`, the public campaign pages and the jobs' imports all read them, so they can't go in `lib/jobs/`.

The shared vocabulary, `staffVocabulary` (`lib/staff-vocabulary.ts`), holds domain words as well as the kit's: the houses, the answers' statuses, countries and fields, which belong to politicians and asks.

## Fix

1. Move each list's parser and filter bar's filters into its feature's `lib/` folder, beside its `defineStaffList`. The top of `lib/` keeps the machinery (`lib/staff-lists.ts`, the parsing and filter helpers), and a registry above every feature assembles each list's for the saved filters.
2. Move the shared vocabulary's domain words (houses, statuses, countries, fields) into the features they're about, leaving `staffVocabulary` the kit's words.
3. Move the bindings' parsing out of `lib/server/outside-services/`, or the parts of politicians' code they read down into `lib/server/`, and have the import log take its notification as a hook, so `lib/server/` imports no feature.
4. Put ControlAI's two parsers beside its binding, as what ControlAI's pages say, where the binding, the import log, politicians, the campaign pages and the jobs can all read them.
5. Then add an ESLint rule that `lib/`'s top-level files and `lib/server/` import no feature folder, with the registry the one exception.

## Hits

- 2026-11-14: docs/code-structure.md had to explain the staff lists' machinery and lib/server/'s bindings as exceptions to what every feature stands on.
