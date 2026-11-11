# Errors reach someone

When a page, a Server Action or a route handler throws on the live site,
the site records it and emails the notification inbox, and admins can
see what has gone wrong lately on a page of the staff interface. One
pull request, built in this order:

1. Record each error and email staff about it, and pages of our own for
   a visitor who meets one.
2. The staff page that lists them.
3. Failures that don't throw: a problem outside a run, and a run of
   refusals.
4. Errors in the browser.

The table serves all four, so its columns are settled for all four
before the branch is first pushed: a pushed migration can't be edited
(`AGENTS.md`, "Migrations are fixed once pushed").

## Now

- Nobody is told. The error is in Netlify's function logs until someone
  looks. Twice a fault was found only by trying the site
  (`investments/error-reporting.md`, "Hits").
- There is no `instrumentation.ts`, no `app/global-error.tsx` and no
  `error.tsx`, so a visitor sees Next's own page.
- A job's failures do reach someone: a run keeps its problems, and staff
  are emailed about a failure or a new problem (`lib/server/import-runs.ts`).
  That stays as it is. An error a run catches never reaches Next, so it
  isn't reported twice.
- `problem()` outside a run, as in a form or a webhook, is only logged
  (`lib/server/problems.ts`).
- A submission Turnstile rejects is a `console.warn` and a message to the
  sender (`lib/server/outside-services/turnstile.ts`). Nothing counts
  them, so every sender being refused looks the same as none.

## Rules

- No new outside service. The email goes by `notifyStaff`
  (`lib/server/notifications.ts`), as every other alert does. Sentry
  would be a new processor of personal data, a wrapper round the build
  and a hole in the CSP.
- Reporting an error never throws and never slows the answer by more
  than one query and one email. If the database or Postmark is what's
  broken, it logs both errors and gives up: an outside monitor is what
  catches that (`investments/scheduled-job-alerts.md`), not this.
- The key that says two errors are the same is coarse on purpose. Two
  bugs sharing a row costs a day; one bug making a row each time floods
  the inbox.
- Whatever the key, emails are capped.
- No final copy: the error pages' words, the email's and the staff
  page's are placeholders (`AGENTS.md`, "Never write final copy").

## 1. Record and email

### The hook

`instrumentation.ts` exports `onRequestError`, which Next calls with the
error, the request (path, method, headers) and the context: the route's
pattern (`routePath`, such as `/staff/politicians/[id]`) and what was
running (`routeType`: `render`, `route`, `action` or `proxy`)
([Next docs](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#onrequesterror),
and `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation.md`).
It must await its work. It only calls `recordError()` in a new
`lib/server/errors-seen.ts`, so the file at the root stays a few lines,
tested as `proxy.ts` is.

To check before building on it, each with a test or a note in the code:

- That `redirect()`, `notFound()` and an aborted response don't reach the
  hook. Next's handler returns early for them
  (`node_modules/next/dist/server/app-render/create-error-handler.js`,
  `getDigestForWellKnownError`), but confirm it on a build.
- Which runtime the hook loads in on Netlify. The file can load in the
  edge runtime too, where `pg` won't, so it may need
  `process.env.NEXT_RUNTIME` (same docs, "Specifying the runtime").
- What Next throws when a browser on an old deploy posts a Server Action
  the new one doesn't have. With many deploys a day this will be common,
  and it isn't a fault of ours.

### What's the same error

The key is made from:

1. `routePath` and `routeType`. Never the request's path:
   `/staff/politicians/4127` and `/4128` are one page, and a path can
   hold a login token.
2. The error's class name.
3. For a Postgres error, its `code` and `constraint`, and nothing of its
   message, which can quote the value that was refused.
4. For any other, its words as `describeError()` gives them, causes
   included, with what varies replaced by a placeholder: numbers, email
   addresses, URLs, UUIDs and long hex strings, and anything in quotes.

Not Next's `digest`: it's a hash of the message and the stack
(`create-error-handler.js`), and the stack names bundled files, so it
would probably change with every deploy. Not the stack either, for the
same reason.

How this goes wrong, and what covers it:

- Two bugs on one route with the same words share a row. The row keeps
  the latest stack, so the second shows once the first is fixed.
- Words with a variable part the replacing misses make a row each time.
  The cap below covers it, and the fix is a line in the replacing.
- For a Server Action, Next gives the page it was called from, not which
  action. Two actions on a page are told apart by their words alone.

When our own errors carry codes, one of ours is keyed by its code and
nothing else, and the replacing is left for libraries' and outside
services' errors.

### The table

One migration, numbered after main's last when the branch is pushed
(`npm run worktree` says the next free number). A row per key:

- the key, unique, and its parts (route, type, class, code), the type
  being one of Next's four, a problem outside a run (part 3) or one of
  the browser's two (part 4);
- the words with their variable parts replaced;
- the latest occurrence's words as thrown, and its stack;
- for a browser's error, the latest report's browser, by name and
  version;
- first seen, last seen, and how many times;
- when staff were last emailed about it.

An occurrence is one upsert: add the row or raise its count, set last
seen, and overwrite the latest words and stack.

### The email

- A new row emails the notification inbox once. A row that goes on
  happening emails again at most once a day, saying how many times
  since.
- The row is claimed before the email is sent (an `UPDATE … WHERE` on
  when it was last emailed, `RETURNING`), so two requests failing at
  once send one email.
- At most a few emails an hour across all rows, the number a constant.
  Past that, one email says there are many, and no more go until the
  hour is up.
- The email holds the route, the words with their variable parts
  replaced, the count, and a link to its row on the staff page (part
  2). Not the words as thrown,
  and not the stack: what's sent to Gmail can't be erased from here.
- A short list in code of keys that are recorded but never emailed, for
  noise that isn't ours to fix, starting with the stale Server Action if
  the check above finds it reaches the hook.
- In development nothing is recorded or sent: the error is on the
  screen. A fixture build records and sends, to the fixture outbox, so
  the storyboard can show it.

### The pages a visitor sees

- `app/global-error.tsx`, which replaces the root layout, so it has its
  own `<html>` and `<body>`
  ([Next docs](https://nextjs.org/docs/app/api-reference/file-conventions/error#global-error)).
- An `error.tsx` for the public site and one for `/staff`, inside their
  layouts, each with a button to try again. In this version of Next the
  page is given `error` and `retry`
  (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`).

Their words are placeholders. Check the gallery for what they can be
built from before writing a component.

### Tests and storyboard

- Unit tests for the key (each kind of replacing, a Postgres error, a
  cause), the upsert, the claim, the daily repeat and the cap, with a
  fixed clock.
- A fixture-only page that throws when asked, as the gallery is fixture
  only, so a flow can reach an error. One flow: a visitor meets the
  error page, staff get the email, the same error again sends nothing.
- `docs/testing.md`, "What the storyboard covers", gets a line.

## 2. The staff page

One read-only list for admins, as the audit log and the sent emails are,
most recent first: the route, the words, first seen, last seen, how many
times. Opening a row shows the latest words as thrown and its stack.

- Built from the staff kit, with a gallery example and a flow.
- The nightly tidying (`lib/server/log-retention.ts`) deletes a row not
  seen for a month, the audit log's term, so an error that's fixed drops
  off by itself.
- Left out: a "resolved" button, assigning, charts, grouping, search,
  request bodies and headers.

## 3. Failures that don't throw

- `problem()` outside a run records to the same table, keyed by its
  sentence, with a type of its own beside the four route types. It has
  no route to key on, and its sentence is fixed, with any count or list
  in the error (`lib/server/problems.ts`).
- A rejected Turnstile check is counted. When the last several letters'
  checks were all rejected and none passed between, staff are emailed
  once, until one passes. The number is a constant, to be picked from
  how often real senders are refused, which needs a look at the logs
  first.
- The same shape may suit other refusals later (the march form, the
  join form). Only letters in this pull request.

## 4. Errors in the browser

The hook sees only what the server throws. The letter form, the letter
editor and the broadcast writer do much of their work in the browser,
where a bug could stop every letter with nothing thrown on the server.

### What reports

- **The error pages** (part 1). Each is handed the error it caught. One
  from the server arrives in production with its words removed and a
  `digest`, and the hook has recorded it already, so the page reports
  nothing. One thrown in the browser, while a client component renders,
  arrives whole, and the page posts it to the route below.
- **A listener**, a small client component in the root layout, on the
  browser's `error` and `unhandledrejection` events: an error in a
  click, input or timer handler, or a promise that fails with nothing
  catching it. It drops what has no frame from our own scripts in its
  stack, which takes out extensions, in-app browsers' injected scripts
  and other sites' "Script error.".

To check: what a chunk from an old deploy failing to load looks like in
each, as with many deploys a day it will be common.

### The key

As a server error's, with two types of its own, one for the error
pages' and one for the listener's. The browser knows the page's real
path, not the route's pattern, so the path has its variable parts
replaced: `/staff/politicians/4127` becomes `/staff/politicians/<n>`.

### The route

One route handler takes a POST with the error's class, words and stack,
the page's path and which of the two types it is. Anyone can post
anything to it, so:

- Each field is cut to a fixed length before anything is stored.
- A request from another origin is refused.
- At most a fixed number of new browser rows an hour, the number a
  constant; past that, reports are dropped. A repeat of a known row
  only raises its count. Not a limit for each address, which would mean
  storing IP addresses.
- The report is sent so that it survives the page closing (`keepalive`).
- `docs/testing.md`, "What the storyboard covers", gets a line for the
  route.

### The emails

- An error page's report emails as a server error does, as the visitor
  has lost the page. The listener's are recorded and not emailed: they
  show on the staff page with their counts, and a list in code names
  the keys that have earned an email, empty to start with.
- A browser error's email says which page, how many times, and links to
  the row. It quotes none of the report, whose words are whatever was
  posted.
- Browser errors have an hourly cap of their own, so junk posted to the
  route can't use up the server errors' cap and hide a real one.

### Tests and storyboard

The fixture-only page (part 1) can also throw in the browser, while
rendering and from a click. The flow shows the error page, the email and
both rows on the staff page.

## Personal data

- An error's words can hold personal data by accident: an address in a
  message, an ID. The key's replacing takes most of it out of what's
  kept for long and out of everything emailed.
- The row's latest words as thrown and its stack are kept as they are,
  as that's what a fault is found from. Each occurrence overwrites them,
  and the row goes a month after it's last seen. Only admins see them.
- Request paths, bodies and headers are never stored. A browser's
  report keeps the page's path with its variable parts replaced, and the
  browser's name and version from the latest report, as a bug is often
  in one browser only: no address, and not the whole User-Agent.
- `docs/data-protection.md` gets a row for it: what it may hold, why,
  who sees it, how long.
- Erasure can't find a person in it, as nothing is keyed by them. The
  month's limit is what removes it, as with the audit log.
- The privacy policy doesn't change, as nothing new is collected on
  purpose. Francis to confirm.

## Not in this plan

- Mapping a browser's minified stack back to the source. The repo is
  public, so Next's browser source maps would give nothing away, but
  the staff page shows the stack as it came.
- CSP reports, which stay in the function logs: browser extensions make
  too many.
- A health route and an outside uptime monitor
  (`investments/scheduled-job-alerts.md`).

## Docs, when done

- `docs/domain-concepts.md`: the list of what emails the notification
  inbox, and the staff page.
- `docs/code-structure.md`: `instrumentation.ts`, and where an error's
  key is made.
- The pull request deletes `investments/error-reporting.md` and this
  plan.

## Questions for Francis

1. Should deploy previews email? They record in their own database
   either way, and send only where `NOTIFICATION_INBOX` is set.
2. Admins only for the page, or everyone on staff?
3. Is a month right for a row not seen again?
