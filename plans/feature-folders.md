# Feature folders

A chain of stacked PRs that puts each staff feature's code in one place: its components, words, gallery examples and Server Actions in a folder under `app/(staff)/staff/_components/`, and its logic, server code, emails and problem messages in a folder under `lib/`. It finishes these investments: `copy-beside-features`, `staff-components-by-feature`, `gallery-beside-components`, `module-boundaries` and `narrow-imports` (`flows-that-reach-less` went first). This file is deleted by the chain's last PR.

## The layout

```
app/(staff)/staff/_components/
  ui/                 the kit, as now
  shell/              the staff pages' frame: nav, page, dev preferences
  <feature>/          Component.tsx, Component.test.tsx (or .browser.test.tsx),
                      Component.gallery.tsx, copy.ts, actions.ts
lib/
  staff-vocabulary.ts the words every feature shares: statuses, houses,
                      fields, countries, filters, paging, lists, search,
                      breadcrumb, deleting, the page title
  <domain>/           the domain's pure and server code together; server
                      files keep `import "server-only"`; copy.ts for the
                      words its server code sends or logs, and those its
                      pure code and the UI share
  server/             only what every domain stands on: db, sql, config,
                      json, problems, run-store, random-id, fixtures/,
                      outside-services/, and the like
```

`app/(staff)/staff/_components/<feature>/` and `lib/<feature>/` share the feature's name. `lib/events.ts` is the public site's events: the events PR renames it (`lib/site-events.ts`, say) or folds it in, so `@/lib/events` doesn't mean two things.

A UI feature's `copy.ts` holds the words only its components use. Words the domain's server or pure code also use live in `lib/<domain>/copy.ts`, and the UI imports them from there. Each copy file exports one object named for the feature (`eventsCopy`), so tests refer to words by name as they do now.

## Features and domains

One PR each, in this order. Each moves its UI folder, its `lib/` domain, its words out of `staffCopy` (lib/content/staff-interface.ts), its gallery examples and its Server Actions. The staffCopy keys listed are a guide: follow the readers.

| PR | UI folder | lib/ domain | staffCopy keys |
|---|---|---|---|
| accounts | `accounts/`, `shell/` | `lib/accounts/`: staff auth, login, dev login, sessions, permissions, staff accounts, Gmail connection and tokens, nav-seen | login, devLogin, loginEmail, me, sessions, gmail, accounts, devPreferences, nav |
| events | `events/` | `lib/events/`: events, tags, owners, Luma webhooks and import, march event, staff events list | events |
| supporters | `supporters/` | `lib/supporters/`: supporters, places, sources, facts, contact permissions, opt-outs, erasure, signup uploads, form entries, email settings | supporters, erase, signupUpload, emails (bounced) |
| politicians | `politicians/` | `lib/politicians/`: politicians and their edits, aliases, book, correspondence, email counts, import, find-mp, parliaments, constituencies, wikidata, party colours | politicians, politician, emails (addresses to fix) |
| campaigns | `campaigns/` | `lib/campaigns/`: asks, ask groups, campaigns, campaign versions | asks, campaigns |
| mailings | `mailings/` | `lib/mailings/`: mailings, drafts, pages, recipients, sending, channels, fields, docs, schedule, attachments, copy states | mailings, mailingEditor, mailingPages, copyStates |
| letters | `letters/` | `lib/letters/`: letters and their lifecycle, sending, replies, threads, inbox reading, held replies, relays, all letters, MP letters, one-off emails | letters, allLetters, letterThread, letterChanges, lettersInbox, oneOff, findInGmail |
| broadcasts | `broadcasts/` | `lib/broadcasts/`: broadcasts and their answers, channels, drafts, pages, recipients, replies, sending, days; WhatsApp | broadcastPages |
| jobs | `jobs/` | `lib/jobs/`: the job registry, cron, import runs, run log, sending job, CiviCRM and ControlAI imports, log retention | import, runs, controlAi, controlAiStatement, civicrm, politicianImports, gmailReading, sending, tidying, luma |
| oversight | `oversight/`, `dashboard/` | `lib/email/` (the sending layer: email, delivery problems, Postmark webhooks, MIME, kept messages, notifications); `lib/oversight/` (errors seen, sent emails, audit, field changes, notes) | errorsSeen, sentEmails, changes, notes, home, alert, inboxNames, notifications, problems (what's left) |

The base PR (the first) adds `lib/staff-vocabulary.ts` and moves the shared keys into it: `staffVocabulary`, with metaTitle, opensInNewTab, breadcrumb, deleteIt, deleteItShort, houses, statuses, personStatuses, countries, fields, search, resetFilters, filters, paging and lists. No feature takes those.

The last feature PR also: gives each dashboard tile its own data loading, so the dashboard page imports a tile, not every domain; deletes `lib/content/staff-interface.ts` (and `STAFF_COPY`'s special case in `scripts/storyboard-reach.mjs`, with its tests, or points it at what's left); empties the old big gallery files; adds `npm run reach` (narrow-imports, Fix 3); and deletes the finished investment files. A last PR then rewrites the docs to explain the code's structure clearly and simply.

`problems` (the server's problem messages) is split as each domain moves: a domain's problems go into its `lib/<domain>/copy.ts`.

## Rules that hold the shape

The base PR adds these, and `docs/code-structure.md`, "Feature folders", describes them; each feature PR extends them.

- **Which feature may use which.** `FEATURES` in `eslint.config.mjs` maps each moved feature to the features it may use: `events: ["supporters"]`. A feature's name is both its UI folder and its `lib/` folder. Its files (tests and `*.gallery.tsx` left out) may import `ui/`, `shell/`, their own folders, the listed features' folders, `components/`, `lib/`'s top-level files, `lib/server/`, `lib/content/` (staffCopy, while it lasts, and `plural()`) and `lib/email-parsing/`. The rule refuses `@/lib/<folder>/…` for any other folder, and a relative `../<folder>/…` for any folder beside theirs but those; so import another feature by `@/lib/<feature>/…` or `../<feature>/…`, and anything else outside your folder by `@/`. The top of `_components/` (the unsorted components) stays open to a moved feature, as `lib/`'s top-level files do: a feature that moves before one it uses (events before supporters) can still reach the other's unsorted files. Add a feature's entry when it moves, with only the dependencies it really has; an entry may name a feature that hasn't moved yet, ready for when it does. `featureLayers()` builds the blocks, after LAYERS, repeating LAYERS' lists (a later block's list replaces an earlier one's). `tests/checks/feature-imports.test.ts` lints made-up files against a made-up table, so it holds whatever `FEATURES` says. The import-cycle check (`tests/checks/import-cycles.test.ts`) keeps the table acyclic in practice.
- **Only feature folders.** `tests/checks/staff-components.test.ts` names each file at the top of `_components/`, `lib/` and `lib/server/` by its name up to the first dot (so `Notes` covers `Notes.tsx`, `Notes.module.css` and `Notes.browser.test.tsx`). `STAYS` lists what stays: the staff lists' and forms' machinery, small helpers, the public site's helpers, and in `lib/server/` the database, settings, problems, runs, fixtures' helpers, search, downloads and saved filters. `UNSORTED` lists the rest. It fails on a name on neither list, and on a listed name with no file. A feature PR takes its names off `UNSORTED`. A PR that adds a file at the top of those folders (a split for the import cycles, say) adds it to one of the lists, or better, puts it in its feature's folder.
- **Gallery examples beside their components.** `Component.gallery.tsx` beside `Component.tsx` exports `componentGallery: Example[]` (the type from `app/(tools)/gallery/_components/types.ts`): every component `Component.tsx` exports, each `{ name, file, variants }` as in the big files. A group in `app/(tools)/gallery/_examples/` imports it and spreads it where the examples went (`...componentGallery`), keeping the group's order, so no frame changes and the storyboard's reach (group file → beside file → component) stays narrow. Examples that need state or callbacks go in `Component.gallery.client.tsx` (`"use client"`), as client components with no props, which `Component.gallery.tsx` renders. `tests/checks/gallery.test.ts` requires a beside file for every component in a folder under `_components/` but `ui/`, looks for a component's example only in its beside file when it has one, and fails on a beside file no group imports. Beside files are part of the gallery: ESLint's layers leave them out (they may import the gallery's types and other features' example data), and Knip leaves them out of its graph. The worked example is `KeepSignedIn.gallery.tsx` (`keepSignedInGallery`), in the staff admin group.
- **Server Actions beside their forms.** A feature's actions are in `app/(staff)/staff/_components/<feature>/actions.ts`, starting `"use server"`. Next allows a `"use server"` file anywhere; private folders only keep pages out of routing (`node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md`, `02-project-structure.md`). ESLint's server-code rules already match `app/**/actions.ts`. `tests/checks/staff-auth.test.ts` checks every `"use server"` file, those in `_components/` included, calls `requireStaff()` first. A page imports only the actions it has buttons for.

## How each feature PR goes

1. `git mv` the feature's components, tests and examples into its folder, and its `lib/` files into its domain; rewrite imports.
2. Move its words out of `staffCopy` into the copy files; update the readers and tests.
3. Split its examples out of the big gallery files into `*.gallery.tsx`, spread into the same group at the same place.
4. Move its Server Actions into its `actions.ts`.
5. Add its `FEATURES` entry, take its files off `UNSORTED`, update `scripts/storyboard-reach.mjs` if it names a moved file, and `docs/code-structure.md`'s layout.
6. No words or behaviour change, but plurals go through `plural()`/`count()`. No frame should change.
