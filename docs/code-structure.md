# Code structure

Where code lives in this repo, and the rules for adding more. The test
rules are in `docs/testing.md`.

Next.js doesn't prescribe a layout
(https://nextjs.org/docs/app/getting-started/project-structure). This repo
uses the "split" strategy: shared code at the root, code used by a single
route next to that route.

## Layout

```
app/
  layout.tsx              root: fonts, metadata, cookie consent
  not-found.tsx
  global-error.tsx        in place of any page that threw: Next's own error
                          page (docs/domain-concepts.md, "Errors")
  (site)/                 public pages; layout.tsx renders <Nav> and <Footer>
  (tools)/                unlisted volunteer tools and trackers; layout.tsx
                          renders <Nav> and <Footer>, and turns analytics off
    gallery/              the component gallery: every component on fixture
                          data, fixture builds only (docs/testing.md)
  (staff)/staff/          the staff interface, behind email login; no <Nav>,
                          no analytics, noindex
  (march)/protests/march-against-ai-extinction-nov-26/
                          the march's sign-up, in its own style (Styling,
                          below)
  api/                    route handlers, only for things that need a URL
  sitemap.ts, robots.ts
components/               React components used by more than one route
  layout/                 Nav, Footer, CookieConsent and the rest of the chrome
  ui/                     the design system: Button, fields, tables, tags, cards
  events/                 EventList, LocalGroupEvents
  people/                 PersonCard, StoryShareForm
  posts/                  the blog's index, cards, header and body
  briefings/              the weekly briefings' sheet, boxes, charts and calendar
  local-groups/           LocalGroupPage, which renders every group's page
  tools/                  the tools index's cards, and the kit the
                          collateral maker and QR tool share
lib/                      logic and data, no React state
  server/                 server-side logic and the database;
                          `import "server-only"`
    outside-services/     one binding per outside service, the only
                          code that calls one (outsideFetch)
    fixtures/             what a fixture build (DATA_FIXTURES=1) answers
                          instead of the outside services: their canned
                          answers, the outbox, the settings (fixture-env.mjs)
  content/                the site's content as typed data (people, blog,
                          briefings, ...)
  collateral/             the collateral tool's drawing engine
  email-parsing/          reading email: addresses, MIME, subjects, quoted mail
  events.ts, trackers.ts  pure helpers for one feature each
  metadata.ts             pageMetadata()
styles/                   global CSS: tokens and base styles
public/                   files served as they are: images, fonts, PDFs,
                          favicons, the maps' shapes
data/                     the survey figures and signatories that two pages
                          show, which lib/content/ imports
netlify/                  database migrations, scheduled functions
backup/                   the nightly database backup: a Cloudflare Worker and
                          container, a package of its own (backup/README.md)
proxy.ts                  turns away /staff requests without a session cookie
instrumentation.ts        Next's hooks: keeps each error the server throws,
                          and each problem reported outside a job's run
tests/                    the route list, the fixtures only tests use, Vitest
                          setup
  storyboard/             the Playwright suite (docs/testing.md)
  checks/                 tests that scan the whole repo (placeholder copy,
                          thin pages, staff auth and the rest)
scripts/                  the gate, and database, storyboard, worktree and
                          data scripts (scripts/README.md)
docs/
plans/                    plans for work in progress, deleted when done;
                          nothing references them
investments/              what would make working here faster or safer, and
                          the friction logged against each; deleted when done
```

Route groups like `(site)` don't appear in URLs. Folders starting with `_`
(e.g. `_components/`) are private: Next never turns them into routes.

## Rules

A rule about which code may import or call what is enforced by an ESLint
rule in `eslint.config.mjs`, not left to review. A new rule of that kind
gets its ESLint rule in the same change, and the rule's message says where
the code should go instead. The rules below say which ones are enforced.

- **Where a component goes.** One used by two or more routes goes in
  `components/`. One used by a single route goes in that route's
  `_components/`.
- **Which folders import which.** An ESLint rule enforces this (`LAYERS`
  in `eslint.config.mjs`).
  - A route imports `components/` and `lib/`. It imports the
    `_components/` folders above it by a relative path. It never imports
    another route's folder, or anything by `@/app/`.
  - `components/` doesn't import routes.
  - `lib/` imports neither routes nor components. The exception is the
    content in `lib/content/`, which is partly JSX and may import
    components.
  - Nothing in `app/`, `components/` or `lib/` imports `tests/`. What a
    fixture build needs is in `lib/server/fixtures/`.
  - Tests may reach across. The component gallery imports every route's
    components, but not `tests/`.
- **Redirects are in `next.config.ts`.** A path that only sends people
  elsewhere is an entry in its `redirects()`, never a page that calls
  `redirect()`. On a click within the site, a page that redirects while
  rendering shows the layout's header and footer with nothing between them
  for a moment. So a `page.tsx` may not import `redirect` or
  `permanentRedirect` (`PAGE_REDIRECT` in `eslint.config.mjs`). Some
  redirects depend on what only the request can tell, such as who's logged
  in or a record merged into another. A helper in `lib/` makes those, and
  the page calls it before anything else: `requireStaff()`
  (`lib/server/staff-auth.ts`), or `canonicalSupporter()`
  (`lib/supporters.ts`) for a merged supporter's old ID. Links within the
  site never lead to these redirects, so no one clicking around sees the
  empty layout.
- **A caught error is rethrown or reported.** Code that catches an error
  and carries on reports it with `problem()` (`lib/server/problems.ts`), in
  our words, with the error.
  - Every way out of a catch reports first. An early `break`, `continue` or
    `return` for one kind of error, such as "Gmail refused, try next time",
    skips the report, and the error is lost however often it happens.
    `tests/checks/caught-errors.test.ts` fails on one, but for the few it
    lists as answers rather than failures, each with why.
  - During a run of a job (`asRun()` in `lib/server/import-runs.ts`), the
    problem is kept on the run, so the job's page shows it under the run's
    line. Staff are emailed about it once, and not again until a run has
    gone right or something else goes wrong.
  - Outside a run, as in a form or a webhook, the problem is kept as an
    error, as what the server throws is: on the admins' Errors page, and
    emailed to staff when it's new (`lib/server/errors-seen.ts`;
    `docs/domain-concepts.md`, "Errors"). So a thrown error needs no catch
    to be noticed, and a caught one needs only `problem()`.
  - Nothing in `lib/server`, `app/api` or `netlify/functions` writes an
    error to the log by hand. `console.error` reaches only Netlify's logs.
    `String(error)` drops the error's cause, so a network failure reads
    "fetch failed" and nothing more. `describeError()` keeps the cause.
  - Every job is run by `lib/server/jobs.ts`, as a run of the import log.
  - Three checks enforce these: `tests/checks/caught-errors.test.ts`,
    `problem-reporting.test.ts` and `cron-runs.test.ts`. The first names
    its few exceptions. Each is a catch that answers a question rather
    than carrying on past a failure.
  - A promise nobody waits for says so with `void`
    (`@typescript-eslint/no-floating-promises`), as its rejection would
    otherwise reach only the console.
- **Pages are thin.** A `page.tsx` holds its metadata, its data loading
  (calling `lib/`) and the order of its sections. Content and markup belong
  in components, and helper functions in `lib/`, where they can be tested.
  Pages and layouts are outside the coverage gate, so they have no
  branches at all: no `if`, `? :`, `&&`, `||`, `??`, `?.`, `switch`, loop,
  `try` or default value (`tests/checks/thin-pages.test.ts`).
  - A page that 404s on a missing record calls `found(findPost(slug))`
    (`lib/found.ts`).
  - A page that reads a filter from its URL calls a parser
    (`lib/staff-search.ts`).
  - A page whose markup depends on state renders a component that takes
    the state as props (`LoginForm`, `PoliticianDetails`).
  - Repeated markup becomes a component for one item (`TimelineEntry`,
    `JobRole`). One-off prose can stay as JSX inside a section component.
- **A staff list is defined once** (`defineStaffList` in
  `lib/staff-lists.ts`). The definition gives the list's page, the
  permission it needs, every parameter its URL takes, which of those
  parameters choose what it shows, and its sortable columns. From the
  definition come the types of its URL, the reading of its URL (`read`),
  its sort (`sort`), its table's headings (`columns`) and what a saved
  filter keeps. The rest of a list is in these places:
  - Its parser (`lib/staff-search.ts`) says only what each filter means.
  - Its filter bar's filters (`lib/staff-list-filters.ts`) are named by
    its parameters, each with its label and choices. A filter can be
    chosen more than once where its parameter repeats in the URL. The
    list's component gives the filters only what comes from the database.
  - A list with saved filters is one of `SAVED` (`lib/saved-filters.ts`).
    The saved filters' actions need the list's permission. The list's page
    calls `requireStaff()` itself, first, because
    `tests/checks/staff-auth.test.ts` reads the call there. The page then
    calls `openSavedList()` (`app/(staff)/staff/saved-lists.ts`), which
    gives it the saved filter loaded, what that finds and the page's
    title.
- **Metadata** comes from `pageMetadata()` (`lib/metadata.ts`), which fills in
  the social preview images, the "PauseAI UK | <title>" social title and the
  canonical path. A page's `generateMetadata` reuses the page's loader. The
  function in `lib/server/` that both call is wrapped in React's `cache()`
  (https://react.dev/reference/react/cache), so it queries once a request.
  For that, its arguments must be the same each time: an ID or a slug, not
  an object, as `cache()` compares objects by identity. When the loader
  loads far more than the title, such as an ask's page of answers, the
  metadata has a small query of its own (`askTitle()`).
  `lib/server/page-loaders.test.ts` shows each loader queries once.
- **No scripts in `public/`.** Browser behaviour goes in a typed
  `"use client"` component, like the track record's `Gallery`.
- **Components render their state.** What a component shows comes from
  React state or props, not from an effect that finds elements and edits
  them (`querySelector`, `classList`, `setAttribute`, `innerHTML`). Editing
  them splits the page's state between React and the DOM, and React can
  render over the change. Hold the state in `useState`, and pass it down
  or through a context. Use a ref only for an element an effect has to
  measure or observe (the header's height, the timeline's entries). An
  ESLint rule (`npm run lint`) fails on the DOM calls in `app/` and
  `components/`. The files written before the rule are listed in
  `eslint.config.mjs` (`UNCONVERTED_DOM_EDITS`), to be converted, not
  added to. A genuine exception gets an `eslint-disable-next-line` with
  the reason.
- **Browsers.** The site is built for browsers up to about a year old. In
  older ones it may look a bit off (the mobile menu's scroll lock needs
  `:has()`, Firefox 121+), but it must still work: every page readable,
  every link and form usable. Use a new feature without asking. Flag one
  that would break an older browser.
- **Layouts own the chrome.** Pages don't render `<Nav>`; their route
  group's layout does.
- **Outside services** (Airtable, Luma, Postmark, Gmail, Netlify Blobs,
  postcodes.io, Stripe, Turnstile, Parliament, ControlAI's letter) are each
  called from one binding in
  `lib/server/outside-services/`, through `outsideFetch`
  (`outside-fetch.ts` there), so tests and fixture builds can answer
  instead. The rest of the code calls the binding's functions. A new
  service gets a new binding there, and its canned answers in
  `lib/server/fixtures/outside-services.ts` (`docs/testing.md`, "Mocking").
  The files in that folder import `server-only`, so they can't end up in a
  browser bundle. In the site's code, ESLint rules (`npm run lint`) fail
  on:
  - importing `outsideFetch` outside that folder, or calling `fetch()` in
    server code (`lib/server/`, route handlers, Server Actions);
  - importing Node's network modules, an HTTP client or a service's SDK
    (`NETWORK_IMPORTS`), which make requests the fixtures can't answer;
  - naming a service's API host outside its binding (`SERVICES` in
    `eslint.config.mjs`, where a new binding's host goes). Parliament's and
    ControlAI's are left out, as pages link to them too.
- **Reading email** is all in `lib/email-parsing/`: addresses, MIME and
  headers, subjects and machine replies, the mail a message quotes, and a
  plain text's links and bold. `lib/server/mime.ts` only writes email.
- **Email** goes out only through `send()` (`lib/server/email.ts`), which
  skips blocked addresses and records each send (`docs/domain-concepts.md`).
  An ESLint rule lets only that file import `sendEmail` or `unsuppress`
  from Postmark's binding (`lib/server/outside-services/postmark.ts`), or
  `sendGmail` from Gmail's (`gmail.ts` there).
- **The database** is only reached through `lib/server/db.ts`. It is the
  only file that may import `pg` or read `NETLIFY_DB_URL` (an ESLint rule,
  in `npm run lint`).
  - Queries are plain SQL, with no ORM. A query built from parts, such as
    a list's filters, is written with the `sql` tagged template
    (`lib/server/sql.ts`). Each `${value}` goes as a parameter, and each
    `${sql`…`}` joins the text with its values. So conditions written
    apart compose with `sql.and`, `sql.or` and `sql.where`, never by
    counting `$n` by hand. Text that isn't a value, such as a column's
    name or a condition in the code, goes in with `sql.raw`.
  - Schema changes are new files in `netlify/database/migrations/`, which
    Netlify applies before each production publish and to each preview's
    copy of the database. They must be backward compatible (expand, then
    contract) and work with or without a transaction around the file. Once
    pushed, a migration is never edited, as Netlify refuses one changed
    since it was applied: a change is a new file. Each one is committed
    with `netlify/database/schema.sql` (`docs/development.md`, "Adding a
    migration"). Tables follow the SQL rules below.
- **A letter's status** changes only through `transition()`
  (`lib/server/letter-lifecycle.ts`). It is one statement that moves
  letters from the statuses it's allowed from and logs each one's event.
  So two runs can't both take a letter, and a letter's status always
  matches its history.
  - The statuses, their named sets (such as `ARRIVED` or `NEVER_WENT`) and
    the events are in `lib/letter-status.ts`. `letter_events`' CHECK holds
    to those events. A query asks for a set with `statusIn()`, never a
    list typed out.
  - Every letter, a supporter's or a mailing's, is sent by
    `sendLetterVia(channel, letter)`, beside `transition()`, with a
    `MailingChannel` (`lib/server/mailing-channels.ts`). A new kind of
    letter says what it sends and what becomes of one that can't go. A new
    way to send is a channel.
- **Settings** come from `config` (`lib/server/config.ts`), which reads
  each environment variable and gives it one shape for every caller: an
  address is trimmed and lowercased, and unset and empty are both
  undefined. Nothing else in `app/`, `components/` or `lib/` reads
  `process.env` (an ESLint rule, `PROCESS_ENV_RULE`). The exceptions are:
  - `lib/server/db.ts`, for its connection string;
  - `lib/now.ts`, which runs in the browser too;
  - the fakes in `lib/server/fixtures/`, which the storyboard loads
    outside the site.
- **Links to the site** in emails and redirects are built with
  `siteUrl(path, request)` (`lib/site-url.ts`), on the deploy's own
  address: `https://pauseai.uk` in production (`SITE_ORIGIN`, set in
  `next.config.ts` from Netlify's settings). On Netlify a request's own
  URL has the `main--pauseaiuk.netlify.app` host, and anyone can set its
  Host. So the site's code never reads a request's URL, origin or Host
  header, or `SITE_ORIGIN` itself (an ESLint rule, in `npm run lint`).
  Links in pages are relative.
- **Staff pages** each call `requireStaff()` (`lib/server/staff-auth.ts`)
  first, as does every staff route handler and Server Action
  (`tests/checks/staff-auth.test.ts`). `proxy.ts` only checks the cookie exists.
  A page that shows more to staff who may see supporters asks
  `canSeeSupporters(staff)`, beside `requireStaff()`.
- **Scheduled jobs** are Netlify scheduled functions. Each is in its own
  folder in `netlify/functions/`, named after its job, and POSTs to
  `/api/cron/<job>` with `CRON_SECRET` (`netlify/scheduled.ts`).
  - The work itself stays in the Next app. `lib/server/jobs.ts` says what
    runs each job, for that route and for the job's button.
  - Every one is a job on `/staff/scheduled-jobs`, whether or not it imports
    anything and despite the page's name, so that staff can see its runs
    and press its button (`docs/domain-concepts.md`, "Imports").
  - A scheduled function gets 30 seconds. A job that needs longer has a
    background function beside it (`<job>-background`). The scheduled
    function starts the background one, which calls the route and can go
    on for 15 minutes.
  - The backup Worker in `backup/` runs on Cloudflare, outside the site,
    so it isn't one of them.
- **Write it once.** Pages that share a shape share a component: each local
  group page is `LocalGroupPage` plus its content in
  `lib/content/local-group-pages.tsx`, and each flyering tracker is
  `FlyeringTracker` plus a short config.
- **Content vs logic.** Data the site displays (people, posts, press, board)
  goes in `lib/content/`. Logic goes next to the feature it serves
  (`lib/events.ts`, `lib/collateral/`).
- **A post a file.** Each blog post is `lib/content/blog/<slug>.tsx`, and
  each weekly briefing is `lib/content/briefings/<slug>.tsx`. Each
  folder's `index.ts` lists its posts newest first, so a new one is a new
  file and a line there. What the two share is in `lib/content/posts.tsx`:
  a post's fields, byline, images, metadata and feed.
- **Where the words go.** A page's own text is written in the page. A
  tool's words (labels, messages, errors, the emails it sends) go in one
  copy object in `lib/content/<feature>.ts`, such as `copy` in
  `lib/content/email-your-mp.ts` and `staffCopy` in
  `lib/content/staff-interface.ts`. That way the wording can be changed in
  one file without touching the code. Components and tests refer to it by
  name (`staffCopy.syncs.syncNow`), so changing it breaks nothing. Words
  not written yet are placeholders: a draft in English, starting with the
  asterism (U+2042), so that it can't be mistaken for real copy.
  `tests/checks/placeholder-copy.test.ts` fails while any placeholder is
  left, which stops placeholders being deployed (AGENTS.md).
- **Names say which one.** There will be many campaigns, letters, imports
  and statuses.
  - An exported name for one of them names it: `SOBEL_BILL_CAMPAIGN`, not
    `BILL_CAMPAIGN`; `CONTROLAI_LETTER_PAGE`, not `LETTER_PAGE`;
    `ControlAiImportResult`, not `ImportResult`.
  - Generic names (`Signatory`, `Problem`, `ImportRun`) are for the one
    thing shared by all of them.
  - Two exports in the repo shouldn't share a name.
  - Pass the data (an MP's statuses) rather than unpicking one case of it
    at the call site (`signedControlAiLetter`), so the next campaign
    doesn't widen the call site too.
- **Personal data changes the privacy record.** A change that adds,
  copies or uses data about a person, or adds a processor, updates
  `docs/data-protection.md` and the privacy policy in the same change. A
  plan for such a change says what it does to both, and to erasure,
  before anything is built.
- **Comments describe the code as it is**: what it does and why, never
  its history (what it replaced, what changed, which plan brought it).
  History is for commit messages. Nothing references `plans/`, which is
  temporary: a plan is deleted when it's done. The rest of the rules are
  under "Comments" below.
- **Imports** use the `@/` alias for anything outside the current folder,
  except inside `app/`, where nothing is imported by `@/app/` (above): a
  route reaches the `_components/` folders above it by a relative path.
- **Tests** sit next to the code they test (`*.test.ts`,
  `*.browser.test.tsx`); see `docs/testing.md`. Tests of the whole repo,
  rather than of one file, go in `tests/checks/`.

## Comments

A comment describes the code as it stands, to someone reading it for the
first time. It doesn't tell the code's history (above). Beyond that:

- **No measurement that goes out of date.** "A fifth of the MPs", "1790 of
  1880 tests" or "about 40 constituencies" is wrong after the next import
  or run, and nothing in the gate checks it. Write the lasting claim ("most
  MPs have no reply yet") and put the figure in the commit message, which
  has a date. A number the code fixes is fine: a threshold the next line
  compares against, or a cap the config sets.
- **Explain once, where the thing is defined.** The same explanation at
  every call site is one more copy to keep true each time, and the copies
  drift apart. Elsewhere, one line that names the thing is enough.
- **Tests comment the fact a fixture pins, not the fixture.** Write "two
  MPs share a surname, so the match has to use the constituency", not "an
  MP list with a second Smith in it so that matching on surname alone
  picks the wrong one". The reader wants to know which property of the
  data the test depends on, so they keep it when they change the fixture.
- **A comment about code somewhere else has to be checked from both
  sides.** A comment that describes another file, a route, a service or
  what the page shows is a claim about that other place, and whichever
  side moves can break it. If they no longer match, the comment has the
  bug: fix it in the same change as the code, or delete it.

Keep comments short. Readers skip a long comment whole, including the part
that mattered, so cut until only what a reader couldn't work out from the
code remains. Do give the reason for anything a reader might simplify away,
such as an ordering that isn't obvious or a workaround for a quirk in
Next.js or a browser. "Rather than" is fine when it contrasts two options a
reader could pick today ("a fixed height, not max-height, so a small photo
still scales up"). It never contrasts the code with what it used to be.

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
- **Names sort in English order**: `ORDER BY n.name COLLATE "en-GB-x-icu"`.
  The database's collation, `C.UTF-8`, puts capitals before lower case and
  accented letters after z. Views use the name columns, so Postgres won't
  change their collation, and each sort says it instead
  (`tests/checks/name-sorts.test.ts` fails on one that doesn't).

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

The component gallery (`/gallery` on a fixture build; `docs/testing.md`,
"The component gallery") shows every component and its variants. Look
there before writing a new one or new CSS: the piece may exist, or need
only a variant. The look itself (colours, type, buttons, cards) is in
`docs/style-guide.md`.

- **Global CSS is two files.** The root layout imports them, and nothing
  else does. There is no other global stylesheet.
  - `styles/tokens.css` has the fonts, the compact density, and every
    colour, width, shadow, space, type size and corner as a variable.
  - `styles/base.css` has the reset, element defaults, scrolling,
    `.container` and `.inline-link`.
- **A component owns its styles**, in a `.module.css` beside it. A page has
  no stylesheet: it is thin, and its sections are components.
- **No reaching in.** A stylesheet never selects another component's
  elements, by class, data attribute or tag. To make a component look
  different in a context, give it a prop or a variant (`Button`'s `light`,
  `Section`'s `tone`). Where a container needs to size or space its
  children, the child reads a documented custom property that the container
  sets on itself: `--container-width` (`.container`'s width),
  `--button-padding` / `--button-font-size` / `--button-font-weight`
  (`Button`), `--icon-button-size` (`IconButton`). A `className` passed into
  a component is for its place in a layout (margins, position), never for a
  property the component sets itself. Two modules never set the same
  property on the same element. Which one wins would depend on which
  stylesheet the page loaded last, and Next doesn't promise an order.
- **`.container` sets only its sides** (its width, side margins and side
  padding), so a module class on the same element can set its top and
  bottom.
- **Every colour is a token.** No hex, `rgb()`/`hsl()` with numbers, or
  named colour outside `styles/tokens.css`; Stylelint refuses them. An alpha
  uses the `-rgb` channels: `rgb(var(--white-rgb) / 0.1)`.
- **In `components/ui/`, sizes are tokens too.** Margins, padding, gaps,
  font sizes and corners are `--space-*`, `--text-*`, `--radius-*` or the
  density's tokens; Stylelint refuses a raw `px` or `rem` there. Which
  step to use, and when a value needn't be a token, is in
  `docs/style-guide.md` ("Using the spacing", "When a value isn't a
  token"). The kit's files whose sizes aren't tokens yet are listed in
  `stylelint.config.mjs`, to be converted, not added to.
- **Density is a container's.** A screen of tables and filters (the staff
  interface, through `StaffPage`) sets `data-density="compact"` on itself,
  and the kit's fields, tables and tags inside it are tighter. Components
  take no density prop (`docs/style-guide.md`, "Density").
- **Fields are the kit's.** Every `<input>`, `<select>` and `<textarea>` is
  one of those in `components/ui/Controls.tsx`. It is labelled with the
  pieces in `Field.tsx` and laid out with the pieces in `Form.tsx`
  (`tests/checks/form-controls.test.ts`).
- **Class names in a module are short and local** (`.hero`, `.title`), one
  class deep where the markup allows. State a script or a test needs to
  read is an attribute (`data-active`, `aria-pressed`, `aria-expanded`), not
  a class.
- **Shared pieces are components.**
  - A piece used by two or more routes is in `components/`.
    `components/ui/` has the site's kit (buttons, the page hero and
    sections, cards, the forms' pieces, tags, tables and text; the
    gallery's UI group shows them all). `components/layout/` has the
    header, footer and banners. Each of the other folders has the pieces
    of one area.
  - A piece used by one route is in that route's `_components/`. Where
    several of a route's components share a shape, it has a small kit
    there (the staff interface's page frame in
    `app/(staff)/staff/_components/ui/`).
  - A piece a second route needs moves to `components/`. The collateral
    maker's studio layout, which the QR tool shares, is in
    `components/tools/kit/`.
- **Classes from content.** HTML that `lib/` writes as strings (press
  logos, blog footnotes) keeps global class names. The component that
  shows the HTML selects those classes with `:global()` inside its own
  root class. So before deleting or renaming a class as unused, search the
  whole repo, not only `app/` and `components/`.

### The weekly briefings

`/campaigns/briefings` follows its designer's A4 layout, which comes as an
HTML page each week (`docs/style-guide.md`, "The briefings and the march").
It follows the rules above, with these particulars:

- **A briefing is data and its kit.** Each briefing's file,
  `lib/content/briefings/<slug>.tsx`, gives its week and key stories as
  data. Its summary is the key stories' headlines (`defineBriefing` in
  `define.tsx`). The file writes the rest with the pieces in
  `components/briefings/`: `BriefingBox`, `BriefingColumns`,
  `BriefingQuote`, `BriefingText`'s pieces, the charts, `BriefingSources`.
  A new week's briefing is the design's HTML page rewritten with those
  pieces in a new file, which is listed first in the folder's `index.ts`.
  A new chart is a new component in `components/briefings/`.
- **Colours by topic.** The `--briefing-*` tokens are the design's palette,
  one a topic. A box sets `--tone` on itself (`toneStyle` in `tone.ts`).
  What's in the box draws in that colour: its list markers, quote rules,
  headings' accents and charts.
- **Plain elements styled by the sheet.** `BriefingSheet` styles the
  paragraphs, lists, headings and source marks a briefing is written in.
  Those styles are inside `:where()`, so any piece's own class outranks
  them. A box spaces what's in it with its `gap`.

### The march sign-up

`/protests/march-against-ai-extinction-nov-26` (`app/(march)/protests/march-against-ai-extinction-nov-26/`)
is a sub-site in its own poster style (`docs/style-guide.md`, "The
briefings and the march"). It follows the rules above, with these
exceptions:

- **One stylesheet for the sub-site.** Its components share
  `_components/march.module.css`, which is written in the order its rules
  cascade. They take their classes through `m()`
  (`_components/classes.ts`). The stylesheet's element styles sit inside
  `:where(.frame)`. Every page of the sub-site is in that frame
  (`MarchSignupFrame`), so the styles reach nothing outside it. Its
  colours are the `--march-*` tokens in `styles/tokens.css`. Anton is
  self-hosted, and declared there too.
- **Its own fields.** The form's controls are its own, in its style, not
  the kit's (`tests/checks/form-controls.test.ts`).
- **Its own header.** Its layout renders `SignupHeader`, not `<Nav>`, and no
  march banner. It renders the site's `<Footer>` itself, as the other
  layouts with one do.
