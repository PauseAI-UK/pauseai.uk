# Code structure

How the code is laid out, where new code goes, and the rules that keep it
that way. Testing is in `docs/testing.md`, the look in
`docs/style-guide.md`, and what the features do in
`docs/domain-concepts.md`.

## The parts

The repo is one Next.js app with three faces, each a route group in
`app/`:

- **The public site**, `app/(site)/`: who we are, the blog, events, the
  campaigns and Email your MP. The march's sign-up, `app/(march)/`, is a
  sub-site of it with a stylesheet of its own ("The march sign-up", below).
- **The tools**, `app/(tools)/`: the volunteer tools and trackers, and the
  component gallery (`/gallery`, fixture builds only; `docs/testing.md`,
  "The component gallery").
- **The staff interface**, `app/(staff)/staff/`, behind email login: the
  supporters, politicians, letters and the rest, made of features
  ("Feature folders", below).

Route handlers are in `app/api/`, only for what needs a URL (webhooks, the
scheduled jobs' calls, the public forms' posts). Under the routes:

```
app/                      routes; each route's own components in its _components/
components/               components two or more routes use
  ui/                     the site's kit: buttons, fields, tables, tags, cards
  layout/                 the header, footer, cookie consent and banners
  <area>/                 the pieces of one area: briefings/, events/, posts/, ...
lib/                      logic, data and words; no React state
  <feature>/              a staff feature's logic (Feature folders, below)
  server/                 infrastructure: the database, settings, problems,
                          the import and audit logs' keeping
    outside-services/     one binding per outside service, the only code that calls one
    fixtures/             what a fixture build answers instead of the outside services
  content/                the site's content as typed data: people, posts, briefings, ...
  email-parsing/          reading email: addresses, MIME, subjects, quoted mail
  collateral/             the collateral tool's drawing engine
  *.ts                    small helpers, the staff lists' machinery, the public site's helpers
styles/                   the two global stylesheets (Styling, below)
public/                   files served as they are
data/                     the survey figures and signatories lib/content/ imports
netlify/                  database migrations and the scheduled functions
backup/                   the nightly database backup, a package of its own (backup/README.md)
proxy.ts                  turns away /staff requests without a session cookie
instrumentation.ts        keeps each error the server throws (docs/domain-concepts.md, "Errors")
tests/                    the storyboard, the checks of the whole repo, test helpers
  storyboard/             the Playwright suite (docs/testing.md, "The storyboard")
  checks/                 tests that read the whole repo (Rules, below)
scripts/                  the gate, and database, storyboard and worktree scripts (scripts/README.md)
plans/                    plans for work in progress, deleted when done (plans/README.md)
investments/              what would make working here faster or safer (investments/README.md)
```

Next doesn't prescribe a layout
(https://nextjs.org/docs/app/getting-started/project-structure). This is
its "split" strategy: shared code at the root, code one route uses beside
that route. Route groups such as `(site)` don't appear in URLs, and a
folder starting with `_` is private: Next never makes it a route.

## Feature folders

The staff interface is made of features. Each has two folders of the same
name: its components in `app/(staff)/staff/_components/<feature>/` and its
logic in `lib/<feature>/`. So everything about one thing is found
together, and which feature depends on which can be seen and held.

| Feature       | What it is                                                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `email`       | The sending layer: sending, blocked addresses, Postmark's bounce and delivery webhooks, the notifications to staff, kept messages                                   |
| `accounts`    | Staff accounts: login, sessions, permissions, your own page, the connected Gmail accounts, and `send()`                                                             |
| `asks`        | What we ask politicians: the asks, their kinds and the answers each allows                                                                                          |
| `notes`       | The notes on a supporter's or a politician's page                                                                                                                   |
| `letters`     | Letters to politicians and their lifecycle: sending, the letters inbox, replies, relays, threads, the one-off emails, and how a copy of something sent to many went |
| `politicians` | Politicians: their records, staff's edits, addresses and aliases, correspondence, the imports of each body's members, finding an MP by postcode                     |
| `supporters`  | Supporters and the records linked into them: places, sources, contact permissions, opt-outs, form entries, sign-up uploads                                          |
| `mailings`    | Mailings to politicians: drafts, the letter and its merge fields, who they're for, schedule, sending; and the campaigns' pages                                      |
| `events`      | Our events: the list, tags, owners, the Luma import and webhooks, the march's and PauseFest's events                                                                |
| `erasure`     | Erasing a supporter from every table that holds them                                                                                                                |
| `dashboard`   | The staff home: the tiles, each loading its own numbers, and what needs a person                                                                                    |
| `broadcasts`  | Broadcasts to supporters, by email and WhatsApp: the writer, who they're for, sending, replies and our answers                                                      |
| `oversight`   | What staff check the site by: the audit log's page, the emails sent, the errors seen, and what each feature's emails do about a bounce                              |
| `jobs`        | The scheduled jobs: what runs each, the schedule's calls, reading Gmail, sending, the CiviCRM and ControlAI imports, tidying the logs                               |

Beside the features, `_components/` has `ui/`, the staff kit (the page
frame, tables, filters, menus), and `shell/`, the frame every staff page
sits in (the sidebar, and every page's name in it). `_components/email/`
has the blocked addresses' parts that need no other feature.

### Which feature uses which

`FEATURES` in `eslint.config.mjs` lists each feature with the features it
may use. Every feature but `email` uses `accounts` (for `requireStaff()`
and `Permission`), and most use `email`. Leaving those two out, each row
uses only rows below it:

```
jobs          every feature whose work a job does
oversight     supporters, politicians, letters, broadcasts
broadcasts    supporters, politicians, letters, mailings
events        supporters
erasure       supporters, letters
dashboard     asks, supporters, letters
supporters    politicians, letters
mailings      asks, politicians, letters
politicians   asks, notes, letters
letters       asks
asks, notes   (accounts only)
accounts      email
email         nothing
```

So a feature is a layer, and a change low down (`letters`) can reach
everything above it, while one high up (`broadcasts`) reaches little. A
review runs only the storyboard flows a change can reach
(`docs/testing.md`, "Which flows a review runs"), so keeping each feature
low and its imports narrow keeps reviews short. `npm run reach` lists the
files that reach the most flows.

### Why things sit where they do

Each of these follows from the order above: a feature can't use one above
it.

- **The sending layer is at the bottom.** Every feature that writes to
  anyone sends through `email`, so `email` can use none of them. What a bounce
  of a feature's email does (mark a letter, opt a supporter out) is handed
  in: each feature gives its hooks (`DeliveryHooks`), and
  `lib/oversight/delivery-problems.server.ts`, above them all, puts them
  together for the webhook and the Gmail reader.
- **`send()` is accounts'** (`lib/accounts/email-sending.server.ts`). It's
  the sending layer's `sendWith()` with the Gmail access of the connected
  staff accounts, whose tokens are accounts'. Every feature that sends
  already uses accounts, so nothing that sends sits below it.
- **The audit log and the import log are below every feature.** Every
  feature writes to the audit log (`lib/server/audit.server.ts`,
  `lib/audit-events.ts`, `lib/field-changes.ts`), and events' and
  politicians' imports keep their runs in the import log
  (`lib/import-runs.ts`, `lib/server/import-runs.server.ts`). In
  `oversight` or `jobs`, the features they log would have to use those.
  Reading them back for their pages is oversight's and jobs'. Only the
  sending layer is below them, as the import log emails staff about a
  failed run; the audit log's entries name features' types, which cost
  nothing at run time.
- **Asks stand alone.** An ask needs nothing of politicians, while a
  politician's record, list and page all show answers to asks. So
  politicians, mailings and letters use asks.
- **Letters is below politicians and mailings.** Both send letters and show
  them, and politicians' address book matches one-off emails, which are
  letters'. Where a letter's page shows something of a higher feature, the
  page hands it in: `LetterThread` takes `showLetter` (a mailing's letter,
  `MailingLetter`), and `LetterView` takes `answer` (politicians' `AskRow`).
- **Erasure is its own feature.** It erases from every table, so it uses
  supporters and letters. In supporters, it would make supporters and
  letters use each other.
- **Notes are their own feature.** Supporters' and politicians' pages both
  show them, and they need only accounts.
- **The dashboard's tiles load their own numbers** (`lib/dashboard/`), and
  the page puts them together, so each group of tiles reaches only what it
  counts.
- **`lib/server/` is infrastructure only**: what any code stands on,
  whatever the feature (the database, `sql`, settings, problems, runs, the
  outside services' bindings, the fixtures, MIME, the lists' search,
  downloads and saved filters). A feature's server code is in its own
  folder. Two kinds of file there read a feature's pure code: the saved
  filters, which know each list's filters (below), and the bindings for
  the bodies' lists of members and postcodes, which read politicians'
  parsing of a list and constituencies' names.
- **`CampaignName` is at the top of `_components/`.** Supporters',
  politicians', letters' and the audit log's pages show a campaign's link.
  In mailings, whose pages the campaigns are, it would make politicians
  and mailings use each other.
- **The public site may use a feature's logic**: Email your MP finds an MP
  with politicians' and sends with letters', and the contact preferences
  page reads supporters' settings. `components/` and the public routes
  aren't features, so the table doesn't hold them, but nothing in `lib/`
  imports them back.

Where a lower module needs something of a higher one, move it down or have
the higher one pass it in, as above. The words follow the same order
("Where the words go", below).

### What every feature stands on

At the top of `_components/`, of `lib/` and of `lib/server/` is only what
stays outside the features: the staff lists' and forms' machinery
(`lib/staff-lists.ts`, `lib/staff-search.ts`, `lib/staff-list-filters.ts`,
saved filters), the staff frame's logic (`lib/staff-sections.ts`), the
audit and import logs, small helpers (`lib/found.ts`, `lib/now.ts`), and
the public site's own (`lib/site-events.ts`, `lib/email-your-mp.ts`).
Most of it uses no feature. The staff lists' machinery is the exception:
it knows every list's filters, so it reads their values from each
feature's `lib/` folder, and each list uses it. `STAYS` in
`tests/checks/staff-components.test.ts` lists each file, with why. The
check fails on a file not on the list, so a new file goes in its feature's
folder, or on the list with its reason.

## Where things go

| To add                                   | Put it in                                                                                                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| a page                                   | `page.tsx` in its route: its metadata, data loading and the order of its sections, nothing else ("Pages are thin", below)                                                                                  |
| a component one route uses               | that route's `_components/`, or the nearest `_components/` above the routes that share it                                                                                                                  |
| a component two routes use               | `components/`: `components/ui/` if it's part of the kit, else the area's folder                                                                                                                            |
| a staff component                        | its feature's folder, `app/(staff)/staff/_components/<feature>/`; the kit's pieces in `ui/`                                                                                                                |
| a component's test                       | beside it: `Component.browser.test.tsx` (`docs/testing.md`)                                                                                                                                                |
| a component's gallery example            | beside it: `Component.gallery.tsx`, imported by its group in `app/(tools)/gallery/_examples/`; outside a staff feature, it may go in the group's file instead (`docs/testing.md`, "The component gallery") |
| example data the gallery and tests share | `Component.examples.ts` beside the component (`LettersTable.examples.ts`)                                                                                                                                  |
| a staff feature's logic                  | `lib/<feature>/`; its reading and writing of its own tables in `records.server.ts`                                                                                                                         |
| server-only code                         | a `.server.ts` module ("Where code runs", below), in its feature's `lib/` folder, or in `lib/server/` if it's infrastructure                                                                               |
| a Server Action                          | its feature's `actions.ts` (`"use server"`), beside the forms that send it; it calls `requireStaff()` first                                                                                                |
| a staff feature's words                  | `lib/<feature>/copy.ts` if anything in `lib/` reads them, else the components' `copy.ts` ("Where the words go", below)                                                                                     |
| a problem message                        | the `problems` of the feature's `lib/<feature>/copy.ts`; the server's own, `serverCopy` (`lib/server/copy.ts`)                                                                                             |
| a public tool's words                    | one copy object in `lib/content/<tool>.ts`, such as `copy` in `lib/content/email-your-mp.ts`                                                                                                               |
| content the site shows                   | `lib/content/`: a blog post is `lib/content/blog/<slug>.tsx`, a briefing `lib/content/briefings/<slug>.tsx`, each listed newest first in its folder's `index.ts`                                           |
| a call to an outside service             | its binding in `lib/server/outside-services/`, and its canned answers in `lib/server/fixtures/outside-services.ts` ("Outside services", below)                                                             |
| a route that needs a URL                 | `app/api/`                                                                                                                                                                                                 |
| a redirect                               | `redirects()` in `next.config.ts` ("Redirects are in `next.config.ts`", below)                                                                                                                             |
| a scheduled job                          | its function in `netlify/functions/<job>/`, its work in the app, run by `lib/jobs/jobs.server.ts` ("Scheduled jobs", below)                                                                                |
| a schema change                          | a new migration in `netlify/database/migrations/` (`docs/development.md`, "Adding a migration")                                                                                                            |
| a test of one file                       | beside it, named for it: `x.test.ts`, `x.server.test.ts`, `Component.browser.test.tsx`                                                                                                                     |
| a test of the whole repo                 | `tests/checks/`                                                                                                                                                                                            |
| a flow a person takes                    | the storyboard, `tests/storyboard/` (`docs/testing.md`, "The storyboard")                                                                                                                                  |

**Names in a feature's folder drop what the folder says**:
`lib/accounts/session.ts`, not `staff-session.ts`; `lib/letters/lifecycle.server.ts`,
not `letter-lifecycle`. Keep a word where dropping it would leave the name
unclear (`letters-inbox.server.ts`). Where a pure module and a server one
would share a name, the server one keeps it and the pure one is named for
what it holds (`lib/supporters/records.server.ts` and
`lib/supporters/supporters.ts`). Components keep their names.

**Imports** use the `@/` alias for anything outside the current folder.
Inside `app/`, a route reaches the `_components/` folders above it by a
relative path, never by `@/app/`; a staff feature's components reach
another feature's by `../<feature>/`.

## Where the words go

Words are kept apart from the code, in copy objects, so they can be changed
in one file, and components and tests refer to them by name
(`jobsCopy.runs.replaced`), so changing them breaks nothing. A page's own
text may be written in the page.

- **A staff feature's words** are in one object named for it
  (`accountsCopy`), in up to two files. `lib/<feature>/copy.ts` has those
  its logic or server code reads (emails, problems, words a component shares
  with `lib/`). `_components/<feature>/copy.ts` has those only its
  components use, and spreads the first, so a component imports only its
  own folder's `copy.ts`. A feature whose components have no words of their
  own (`events`, `asks`) has no components' copy.
- **Words several features share** are `staffVocabulary`
  (`lib/staff-vocabulary.ts`): the kit's (the page title, the trail,
  deleting, a list's search, filters and paging) and the domain's (houses,
  statuses, countries, fields, the politicians' markers). The staff frame's
  page names are `shellCopy` (`_components/shell/copy.ts`).
- **Words below every feature** are with the code below every feature: the
  import log's `importRunsCopy` (`lib/import-runs-copy.ts`), and the
  server's own problems, `serverCopy` (`lib/server/copy.ts`).
- **A number in words** goes through `plural()` or `count()`
  (`lib/content/plural.ts`).
- **Words not written yet** are placeholders, starting with the asterism
  (U+2042). `npm run placeholders` fails while one is left, in CI and in
  Netlify's build, so none is deployed (AGENTS.md, "Never write final
  copy").

## Where code runs

A module's name says where it runs, wherever its folder is:

- `x.server.ts` runs only on the server, and starts `import "server-only"`.
  Next stops the build if a client component imports it, so a secret or a
  query can't end up in the browser. A module that reads `process.env`, or
  imports the database (`db.server.ts`, `sql.server.ts`), the settings
  (`config.server.ts`) or an outside service's binding, is one of these.
- `x.client.ts` runs only in the browser, as it uses `window`, `document`,
  storage or a canvas when it's called, and starts `import "client-only"`.
  Next stops the build if a server component imports it.
- Anything else runs on both: pure logic, types, words, and components.
  A component has no suffix, `"use client"` or not.

A test is named for what it tests (`x.server.test.ts`). These keep their
names: Next's own files (`page.tsx`, `route.ts`, `instrumentation.ts`),
Server Actions (`actions.ts`, which the browser calls), the gallery's
examples with state (`*.gallery.client.tsx`), `scripts/`, `tests/`,
`netlify/`, the fakes in `lib/server/fixtures/` (the storyboard loads them
outside the site, where `server-only` throws) and `lib/now.ts`, the clock,
which runs on both. `tests/checks/runs-where.test.ts` holds all of this.

The two packages are Next's markers
(`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`,
"Preventing environment poisoning"). Vitest gives the tests `server-only`'s
empty module, as they run server code directly.

## Rules

A rule about which code may import or call what is an ESLint rule in
`eslint.config.mjs`, or a check in `tests/checks/`, not left to review. A
new rule of that kind gets its check in the same change, and the check's
message says where the code should go instead. Each rule below names what
holds it.

### Imports

- **Which folders import which** (`LAYERS` in `eslint.config.mjs`):
  - a route imports `components/`, `lib/` and the `_components/` folders
    above it, never another route's;
  - `components/` doesn't import routes;
  - `lib/` imports neither routes nor components, but for `lib/content/`,
    which is partly JSX;
  - nothing in `app/`, `components/` or `lib/` imports `tests/`: what a
    fixture build needs is in `lib/server/fixtures/`;
  - tests, the gallery and the examples beside components may reach
    across.
- **A staff feature imports only the features it's listed with**
  (`FEATURES` in `eslint.config.mjs`, "Which feature uses which", above),
  and what every feature stands on: `ui/`, `shell/`, `components/`, `lib/`'s
  top-level files, `lib/server/`, `lib/content/` and `lib/email-parsing/`.
  `tests/checks/feature-imports.test.ts` tests the rule itself.
- **Only feature folders**: a file at the top of `_components/`, `lib/` or
  `lib/server/` is on `STAYS` (`tests/checks/staff-components.test.ts`;
  "What every feature stands on", above).
- **No import cycles**: no module imports itself, however far round, type
  imports aside (`tests/checks/import-cycles.test.ts`).

### Pages

- **Pages are thin.** A `page.tsx` holds its metadata, its data loading
  (calling `lib/`) and the order of its sections. Markup is in components,
  and logic in `lib/`, where they can be tested. Pages and layouts are
  outside the coverage gate, so they have no branches at all: no `if`,
  `? :`, `&&`, `||`, `??`, `?.`, `switch`, loop, `try` or default value
  (`tests/checks/thin-pages.test.ts`). A page that 404s on a missing record
  calls `found()` (`lib/found.ts`); one that reads a filter from its URL
  calls a parser (`lib/staff-search.ts`); one whose markup depends on state
  renders a component that takes it as props (`LoginForm`).
- **Redirects are in `next.config.ts`**, in its `redirects()`, never a page
  that calls `redirect()`: on a click within the site, such a page shows
  the layout's header and footer with nothing between for a moment
  (`PAGE_REDIRECT` in `eslint.config.mjs`). A redirect that depends on the
  request (who's logged in, a merged supporter's old ID) is a `lib/` helper
  the page calls first: `requireStaff()` (`lib/accounts/auth.server.ts`),
  `canonicalSupporter()` (`lib/supporters/supporters.ts`). Links within the
  site never lead to one.
- **Metadata** comes from `pageMetadata()` (`lib/metadata.ts`): the social
  preview images and title, and the canonical path. A page's
  `generateMetadata` reuses the page's loader, wrapped in React's `cache()`
  (https://react.dev/reference/react/cache) so it queries once a request.
  So its arguments are an ID or a slug, never an object, which `cache()`
  compares by identity (`lib/server/page-loaders.test.ts`).
- **Staff pages** each call `requireStaff()` first, as does every staff
  route handler and Server Action (`tests/checks/staff-auth.test.ts`).
  `proxy.ts` only checks the cookie exists. A page that shows more to
  staff who may see supporters asks `canSeeSupporters(staff)`.
- **A staff list is defined once** (`defineStaffList` in
  `lib/staff-lists.ts`): its page, permission, URL parameters, which of
  them choose what it shows, and its sortable columns. From that come its
  URL's types and reading, its sort, its headings and what a saved filter
  keeps. Its parser (`lib/staff-search.ts`) says only what each filter
  means; its filter bar's filters (`lib/staff-list-filters.ts`) are named by
  its parameters. A list with saved filters is one of `SAVED`
  (`lib/saved-filters.ts`), and its page calls `requireStaff()`, then
  `openSavedList()` (`app/(staff)/staff/saved-lists.server.ts`).
- **Layouts own the chrome.** Pages don't render `<Nav>`; their route
  group's layout does, through `SiteFrame` (`tests/checks/site-frame.test.ts`).

### Components

- **Components render their state**, from React state or props, never by an
  effect that finds elements and edits them (`querySelector`, `classList`,
  `setAttribute`, `innerHTML`), which React can render over. Use a ref only
  for an element an effect measures or observes. ESLint fails on the DOM
  calls in `app/` and `components/`. The files written before the rule
  are `UNCONVERTED_DOM_EDITS` in `eslint.config.mjs`, to be converted, not
  added to.
- **No scripts in `public/`.** Browser behaviour is a typed `"use client"`
  component.
- **Write it once.** Pages that share a shape share a component: each local
  group's page is `LocalGroupPage` and its content in
  `lib/content/local-group-pages.tsx`.
- **Browsers.** The site is built for browsers up to about a year old. In
  older ones it may look a bit off, but every page must stay readable and
  every link and form usable. Use a new feature without asking; flag one
  that would break an older browser.

### Errors

- **A caught error is rethrown or reported** with `problem()`
  (`lib/server/problems.server.ts`), in our words, with the error. Every
  way out of a catch reports first: an early `break`, `continue` or
  `return` for one kind of error loses it however often it happens.
  - During a job's run (`asRun()` in `lib/server/import-runs.server.ts`),
    the problem is kept on the run, shown on the job's page and emailed to
    staff once, until a run goes right.
  - Outside one, as in a form or a webhook, it's kept as an error, as a
    thrown one is: on the Errors page, and emailed to staff when new
    (`lib/oversight/errors-seen.server.ts`; `docs/domain-concepts.md`,
    "Errors"). So a thrown error needs no catch to be noticed.
  - Nothing in the server's code writes an error to the log by hand:
    `console.error` reaches only Netlify's logs, and `String(error)` drops
    the cause. `describeError()` keeps it.
  - `tests/checks/caught-errors.test.ts` (which names its few catches that
    answer a question rather than carry on past a failure) and
    `problem-reporting.test.ts` hold these.
- **A promise nobody waits for** says so with `void`
  (`@typescript-eslint/no-floating-promises`).

### Server code

- **Outside services** (Airtable, Luma, Postmark, Gmail, Netlify Blobs,
  postcodes.io, Stripe, Turnstile, the bodies' lists of members, Wikidata,
  ControlAI, WhatsApp, CiviCRM) are each called from one binding in
  `lib/server/outside-services/`, through `outsideFetch`
  (`outside-fetch.server.ts` there), so tests and fixture builds can answer
  instead (`docs/testing.md`, "Mocking"). ESLint fails on importing
  `outsideFetch` elsewhere, `fetch()` in server code, a network module, HTTP
  client or SDK (`NETWORK_IMPORTS`), and a service's API host outside its
  binding (`SERVICES`, where a new binding's host goes).
- **Email** goes out only through `sendWith()` (`lib/email/email.server.ts`),
  which skips blocked addresses and records each send
  (`docs/domain-concepts.md`, "Email"). The site's code calls it as `send()`
  (`lib/accounts/email-sending.server.ts`), and staff notifications call it
  directly (`lib/email/notifications.server.ts`). ESLint lets only
  `lib/email/email.server.ts` import Postmark's and Gmail's sending.
- **Reading email** is all in `lib/email-parsing/`: addresses, MIME,
  subjects, bounces, quoted mail, a plain text's links.
- **The database** is reached only through `lib/server/db.server.ts`, the
  one file that imports `pg` or reads `NETLIFY_DB_URL` (ESLint). Queries
  are plain SQL. One built from parts, such as a list's filters, uses the
  `sql` tagged template (`lib/server/sql.server.ts`): each `${value}` is a
  parameter, conditions compose with `sql.and`, `sql.or` and `sql.where`,
  and text that isn't a value goes in with `sql.raw`. Never count `$n` by
  hand. Tables follow "SQL", below.
- **Migrations** are new files in `netlify/database/migrations/`, which
  Netlify applies before each publish. Each is backward compatible (expand,
  then contract), works with or without a transaction, and is never
  edited once pushed (AGENTS.md, "Migrations are fixed once pushed";
  `docs/development.md`, "Adding a migration").
- **A letter's status** changes only through `transition()`
  (`lib/letters/lifecycle.server.ts`): one statement that moves letters
  from the statuses it's allowed from and logs each one's event, so two
  runs can't both take a letter. The statuses and their sets (`ARRIVED`,
  `NEVER_WENT`) are in `lib/letters/status.ts`, and a query asks for a set
  with `statusIn()`. Every letter is sent by `sendLetterVia()` with a
  channel (`lib/letters/channels.server.ts`): a new way to send is a
  channel.
- **Settings** come from `config` (`lib/server/config.server.ts`), which
  gives each environment variable one shape: an address trimmed and
  lowercased, unset and empty both undefined. Nothing else reads
  `process.env` (`PROCESS_ENV_RULE` in `eslint.config.mjs`), but
  `lib/server/db.server.ts`, `lib/now.ts` and the fakes in
  `lib/server/fixtures/`.
- **Links to the site** in emails and redirects are built with
  `siteUrl(path, request)` (`lib/site-url.server.ts`) on the deploy's own
  address, never from a request's URL or Host, which on Netlify are
  another host or anyone's to set (ESLint). Links in pages are relative.
- **Scheduled jobs** are Netlify scheduled functions, each in its folder in
  `netlify/functions/`, that POST to `/api/cron/<job>` with `CRON_SECRET`
  (`netlify/scheduled.ts`). The work stays in the app: `lib/jobs/jobs.server.ts`
  says what runs each job, for that route and for the job's button, and runs
  it as a run of the import log (`tests/checks/cron-runs.test.ts`). Each is a
  job on `/staff/scheduled-jobs` (`docs/domain-concepts.md`, "Imports"). A
  scheduled function gets 30 seconds; a longer job has a
  `<job>-background` function beside it, which can run for 15 minutes.

### Naming and data

- **Names say which one.** There will be many campaigns, letters, imports
  and statuses, so an exported name for one of them names it
  (`SOBEL_BILL_CAMPAIGN`, `ControlAiImportResult`), and a generic name
  (`Signatory`, `ImportRun`) is for the one thing all of them share. No two
  exports share a name. Pass the data (an MP's statuses) rather than
  unpicking one case of it at the call site, so the next campaign doesn't
  widen the call site too.
- **Personal data changes the privacy record.** A change that adds, copies
  or uses data about a person, or adds a processor, updates
  `docs/data-protection.md` and the privacy policy in the same change, and
  a plan for one says what it does to both, and to erasure, first.
- **Comments describe the code as it is** ("Comments", below), and nothing
  references `plans/`.

## Comments

A comment describes the code as it stands, to someone reading it for the
first time: what it does and why, never its history (what it replaced,
what changed, which plan brought it), which is for commit messages.

- **No measurement that goes out of date.** "A fifth of the MPs" or "1790
  of 1880 tests" is wrong after the next import or run, and nothing checks
  it. Write the lasting claim ("most MPs have no reply yet") and put the
  figure in the commit message. A number the code fixes, such as a
  threshold the next line compares against, is fine.
- **Explain once, where the thing is defined.** Elsewhere, one line that
  names it is enough; copies at each call site drift apart.
- **Tests comment the fact a fixture pins, not the fixture.** "Two MPs
  share a surname, so the match has to use the constituency", not "an MP
  list with a second Smith in it". The reader needs to know which property
  of the data the test depends on, to keep it when they change the
  fixture.
- **A comment about code somewhere else is checked from both sides.**
  Whichever side moves can break it. If they no longer match, the comment
  has the bug: fix it in the same change, or delete it.
- **A reference in the docs has to lead somewhere.**
  `tests/checks/doc-references.test.ts` fails on a path in backticks, in
  any Markdown file, that isn't in the repo, and on a heading or bold
  lead-in a doc is cited by that it doesn't have, in Markdown or a
  comment. So name a file by its whole path from the top of the repo, and
  cite a heading in its exact words. Plans and investments may name files
  they propose.

Keep comments short: readers skip a long one whole, including the part
that mattered. Do give the reason for anything a reader might simplify
away, such as an order that isn't obvious or a workaround for a quirk.
"Rather than" contrasts two options a reader could pick today ("a fixed
height, not max-height, so a small photo still scales up"), never the code
with what it used to be.

## SQL

Every rule that can be stated in the schema is stated there, so nothing has
to clean up after bad rows.

- **Constrain everything.** Every reference to another row is a foreign key
  with the `ON DELETE` rule that fits. A fixed set of values is `text` with
  a `CHECK (… IN (…))` list, not an enum type. A rule between columns is a
  `CHECK` too: `(status = 'failed') = (error IS NOT NULL)`. A row that
  points at one of several tables has a nullable foreign key column for
  each and `CHECK (num_nonnulls(…) = 1)`, not a `(source, source_id)` pair
  of text. A `CHECK` depends only on the row's own columns, never `now()`
  or another table.
- **Addresses are lowercased in the row** (`CHECK (address =
lower(address))`) when our own code writes them, so equality is plain `=`.
- **History tables are insert-only** (`audit_log`, `email_problems`,
  `letter_events`). The current state is derived from them, or kept in a
  second table written in the same transaction (`email_blocks`).
- **Names sort in English order**: `ORDER BY n.name COLLATE english`, a
  collation of ICU's British English (migration 0109). The database's
  collation, `C.UTF-8`, puts capitals before lower case and accented
  letters after z. Views use the name columns, so Postgres won't
  change their collation, and each sort says it instead, in the query or
  in a sortable list's map of columns (`name: "n.name COLLATE english"`).
  `tests/checks/name-sorts.test.ts` fails on one that doesn't. A list
  sorted in TypeScript compares text with `Intl.Collator("en-GB")`, not `<`,
  which also sorts by character code; the check can't see those.

### How fast a query has to be

Most tables here stay small (staff accounts, import state, a few hundred
MPs), and most queries look rows up by a key that's already indexed. Those
need no thought. Two kinds of query do need it, and get it when they're
written:

- **One a page runs on every view, over a table that keeps growing**
  (`audit_log`, `letters`, `luma_guests`, `supporters`, `import_runs`). It
  reads only the rows it shows: an index on what it filters by, or a
  `LIMIT`. A field inside `jsonb` details gets an expression index, partial
  to the rows it applies to. The index is written exactly as the query
  writes the expression, casts included, or Postgres won't use it
  (`audit_log_status_sets`, for a politician's history).
- **One that builds a row for each of many things from several sources**
  (a list of supporters, each with their name, emails, counts and latest
  activity). It groups each source once and joins the results, rather than
  running a subquery per column for every row (`supporters_summary`).
  Subqueries over views of views, once per row, are what the planner prices
  highest. A list sorted or filtered by a value such a query works out
  can't use an index on that value. So keep the query's rows (a
  materialized view, as `supporters_list`) and read the kept rows. And
  take the page's rows before building their columns, or the columns are
  built for every row the sort reads.

For either, check it before calling it done. Fill a throwaway database to
about the size the real data will reach in a year (`scripts/fresh-database.mjs`
with the fixtures, then `generate_series` for the bulk), and run
`EXPLAIN (ANALYZE)` on the query as the code builds it. It should read an
index rather than scan the whole table, and take milliseconds.

Also look at the planner's cost on a fresh, never-analysed database, which
is what the tests' databases are. Above a cost of 100,000
(`jit_above_cost`), Postgres compiles the query first where it has JIT, as
CI's image does. Compiling can take seconds for a query that runs in
milliseconds. The dev container's Postgres has no JIT
(`pg_jit_available()` is false), so a query too costly for CI still passes
there, and the cost is the only warning.

To see the cost of every query the tests run, including those inside a
PL/pgSQL function, which Postgres plans separately:

1. `ALTER ROLE dev SET session_preload_libraries = 'auto_explain'`, with
   `auto_explain.log_min_duration = 0` and
   `auto_explain.log_nested_statements = on`.
2. Run the tests.
3. Read the plans in Postgres's log.
4. Reset the three settings.

The symptom is a test that times out in CI and passes in the dev container
in milliseconds. The fix is a query the planner prices lower, not turning
JIT off. Postgres prices views of views of unions in the millions, however
few rows they hold. What brings the cost under the threshold:

- Grouping each source once and joining, not a subquery per row:
  `supporters_summary`, and the newest email in `supporters_list`.
- Building a page's columns after taking its rows, and counting apart from
  the page (`listSupporters()`).
- For a few rows worked out from the views, a PL/pgSQL function that looks
  each up by ID in a loop, declared with a small `ROWS`, so the outer query
  is planned as if there are few (`supporters_added()`).
- Finding whose an address is from `supporter_links.matched_value`, which
  has an index, and their name from `supporters_list`, not from
  `supporter_identity`, the union of every source (the blocked emails'
  `BLOCK_SUPPORTERS`).

Before each migration, `migrate()` (`scripts/db-migrate.mjs`) analyses
every table Postgres hasn't analysed yet, as autovacuum has analysed a live
database's tables. So a migration that builds a view over the tables is
planned as production plans it, and isn't priced in the hundreds of
thousands on a fresh test database.

Beyond that, no speculative indexes. An index costs every write to its
table, and is easy to add later, when a query that's actually used turns
out slow.

## Styling

The look itself (colours, type, buttons, cards) is in
`docs/style-guide.md`. Look in the component gallery before writing a
component or CSS: the piece may exist, or need only a variant.

- **Global CSS is two files**, which the root layout imports and nothing
  else does: `styles/tokens.css` (the fonts, the compact density, and every
  colour, width, shadow, space, type size and corner as a variable) and
  `styles/base.css` (the reset, element defaults, scrolling, `.container`
  and `.inline-link`).
- **A component owns its styles**, in a `.module.css` beside it. A page has
  no stylesheet.
- **No reaching in.** A stylesheet never selects another component's
  elements, by class, data attribute or tag. To make a component look
  different in a context, give it a prop or a variant (`Button`'s `light`,
  `Section`'s `tone`). Where a container sizes or spaces its children, the
  child reads a custom property the container sets on itself:
  `--container-width`, `--button-padding` / `--button-font-size` /
  `--button-font-weight` (`Button`), `--icon-button-size` (`IconButton`). A
  `className` passed in is for the component's place in a layout (margins,
  position), never a property it sets itself. Two modules never set the
  same property on the same element: which wins would depend on which
  stylesheet loaded last, and Next doesn't promise an order.
- **`.container` sets only its sides** (its width, side margins and side
  padding), so a module class on the same element can set its top and
  bottom.
- **Every colour is a token.** No hex, `rgb()`/`hsl()` with numbers, or
  named colour outside `styles/tokens.css`; Stylelint refuses them. An alpha
  uses the `-rgb` channels: `rgb(var(--white-rgb) / 0.1)`.
- **In `components/ui/`, sizes are tokens too**: margins, padding, gaps,
  font sizes and corners are `--space-*`, `--text-*`, `--radius-*` or the
  density's tokens, and Stylelint refuses a raw `px` or `rem` there
  (`docs/style-guide.md`, "Using the spacing", "When a value isn't a
  token"). The kit's files not converted yet are listed in
  `stylelint.config.mjs`, to be converted, not added to.
- **Density is a container's.** A screen of tables and filters (the staff
  interface, through `StaffPage`) sets `data-density="compact"` on itself,
  and the kit's pieces inside it are tighter. Components take no density
  prop (`docs/style-guide.md`, "Density").
- **Fields are the kit's.** Every `<input>`, `<select>` and `<textarea>` is
  one of those in `components/ui/Controls.tsx`, labelled with `Field.tsx`'s
  pieces and laid out with `Form.tsx`'s (`tests/checks/form-controls.test.ts`).
- **Class names in a module are short and local** (`.hero`, `.title`), one
  class deep where the markup allows. State a script or a test reads is an
  attribute (`data-active`, `aria-pressed`, `aria-expanded`), not a class.
- **Classes from content.** HTML that `lib/` writes as strings (press
  logos, blog footnotes) keeps global class names, which the component
  showing it selects with `:global()` inside its own root class. So search
  the whole repo, not only `app/` and `components/`, before deleting a
  class as unused.

### The weekly briefings

`/campaigns/briefings` follows its designer's A4 layout, which comes as an
HTML page each week (`docs/style-guide.md`, "The briefings and the march").
It follows the rules above, with these particulars:

- **A briefing is data and its kit.** Each briefing's file,
  `lib/content/briefings/<slug>.tsx`, gives its week and key stories as
  data; its summary is the key stories' headlines (`defineBriefing` in
  `define.tsx`). The file writes the rest with the pieces in
  `components/briefings/`: `BriefingBox`, `BriefingColumns`,
  `BriefingQuote`, `BriefingText`'s pieces, the charts, `BriefingSources`.
  A new week's briefing is the design's HTML rewritten with those pieces
  in a new file, listed first in the folder's `index.ts`. A new chart is a
  new component in `components/briefings/`.
- **Colours by topic.** The `--briefing-*` tokens are the design's palette,
  one a topic. A box sets `--tone` on itself (`toneStyle` in `tone.ts`),
  and what's in it draws in that colour: list markers, quote rules,
  headings' accents and charts.
- **Plain elements styled by the sheet.** `BriefingSheet` styles the
  paragraphs, lists, headings and source marks a briefing is written in,
  inside `:where()`, so any piece's own class outranks them. A box spaces
  what's in it with its `gap`.

### The march sign-up

`/protests/march-against-ai-extinction-nov-26` (`app/(march)/protests/march-against-ai-extinction-nov-26/`)
is a sub-site in the site's style, with a few looks of its own
(`docs/style-guide.md`, "The briefings and the march"). It follows the
rules above, with these exceptions:

- **One stylesheet for the sub-site.** Its components share
  `_components/march.module.css`, written in the order its rules cascade,
  and take their classes through `m()` (`_components/classes.ts`). Its
  element styles sit inside `:where(.frame)`, and every page of the
  sub-site is in that frame (`MarchSignupFrame`), so they reach nothing
  outside it. Its orange is `--march-orange` in `styles/tokens.css`; the
  rest are the site's tokens.
- **Its own fields.** The form's controls are its own, drawn to match the
  site's, not the kit's (`tests/checks/form-controls.test.ts`).
- **No march banner.** Its layout renders the site's `<Nav>` and
  `<Footer>`, but not the march banner, as this is the page the banner
  points to. A skip link comes before the header.
- **Marker pen.** `Marker` draws a hand-drawn underline, circle or
  highlight in the orange with rough-notation. An underline is there from
  the start; a circle or highlight draws in once its words are a third of
  the way up the window.
