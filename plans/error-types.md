# Error handling

## Summary

When something goes wrong on the site, the code describes it in an English
sentence. That sentence is then stored in the database, compared with other
sentences to decide whether to email staff, and in a few places picked
apart with a regular expression. This causes real bugs, such as staff being
emailed again about a problem they've already been told about.

This plan gives each kind of failure a fixed code with typed details, and
writes the English only at the moment a person reads it. It also fixes
the bugs found while reading the code, gives the outside services one
common error type, and gives forms one common way to report a failure.

Each part says what was decided and, where another way was turned down,
why. Rules that hold each change in place are added at every step. The plan
ends with an order of work. Nothing is left to decide.

## How errors are handled today

There are two rules, in `docs/code-structure.md` ("Errors").

**An error nobody catches is recorded.** Next passes every error thrown in
a page, route or Server Action to `onRequestError` (`instrumentation.ts`).
That stores it in the `errors_seen` table. Admins see it on the Errors
page, and staff are emailed when it's new, then at most once a day while it
keeps happening.

**Code that catches an error and carries on must report it.** It calls
`problem(sentence, error)` (`lib/server/problems.server.ts`). What happens
next depends on where the code is running:

- In a scheduled job, the problem is stored on that run of the job
  (`import_runs.problems`) and shown on the job's page. Staff are emailed
  if the run before didn't have the same problem.
- Anywhere else, such as a form or a webhook, it's stored in `errors_seen`,
  as a thrown error is.

Two tests enforce the second rule. `tests/checks/caught-errors.test.ts`
fails on a `catch` that neither rethrows nor calls `problem()`.
`tests/checks/problem-reporting.test.ts` fails on `console.error`.

This design is sound, and the plan keeps it. The weakness is in what gets
recorded, and in a few places the rules don't reach.

## Problems found

Each was found by reading the code. None has been reproduced yet, so each
gets a failing test before its fix.

### 1. Staff are emailed again about a problem they already know about

To decide whether a job's problem is new, `alertIfNew`
(`lib/server/import-runs.server.ts`) compares its sentence with the
sentences of the run before. If the sentence is different, it's treated as
a new problem and staff are emailed.

About 29 of the 84 calls to `problem()` put something that varies into the
sentence, such as a letter's ID, an event's ID, a name or a count. Suppose
Gmail is down and letter 4127 can't be sent. Staff are emailed. On the next
run letter 4128 can't be sent either. The sentence now names 4128, so it
counts as new, and staff are emailed again, every run, until Gmail is back.

Changing the wording of a sentence has the same effect, once, for every
job that's currently reporting it.

### 2. A job that crashes is reported in two places (decided: keep it)

When a job fails, `asRun` records the failed run, emails staff, and then
throws the error again. The route that scheduled jobs come through
(`app/api/cron/[job]/route.ts`) doesn't catch it. So Next should pass it to
`onRequestError`, which would store it in `errors_seen` and email staff a
second time. This is from reading the code, not from seeing two emails.

This stays as it is. A job is meant to handle the errors it expects, with
`problem()`. One that crashes has hit an error nobody expected, which is a
bug, and a bug belongs on the Errors page with its stack trace. The run
stores only the error's message.

Two things don't match that decision, and both get fixed:

- `docs/domain-concepts.md` says a job's failure belongs to its run and
  not to the Errors page.
- The button staff press to run a job (`runJobNow`) catches the crash and
  writes it to `console.error`. So a crash in a run that staff started
  never reaches the Errors page.

### 3. The tests that enforce the rules skip the staff pages

Both tests read `lib/`, `app/api` and `netlify/functions`. They don't read
`app/(staff)/`, which holds every staff Server Action. Three caught errors
there are written to `console.error`, which only reaches Netlify's logs:

- `unblockAddress` (`oversight/actions.ts`). If Postmark can't be reached,
  the address stays blocked and staff are shown nothing.
- The Gmail connection callback (`staff/api/gmail/callback/route.ts`). It
  also writes the staff member's email address to the log.
- `runJobNow` (`jobs/actions.ts`). This one does no harm, because the run
  has already recorded the failure.

### 4. A warning gets past the check

The test bans `console.error` but allows `console.warn`, so a failure
logged as a warning reaches only Netlify's logs, and the test doesn't
notice. Two places log one that way today. Both are deliberate, with a
comment saying why, and stay as they are:

- Luma refusing to remove a contact as someone opts out
  (`email-settings.server.ts`). The Luma import's next pass tries again
  within the hour, and reports it if that fails too.
- The database pool losing an idle connection (`db.server.ts`). The pool
  opens another, and the next query carries on.

The gap is that nothing stops a new one, written without that thought.

### 5. Personal data ends up in the stored problems

Sentences can contain an email address. One does for certain: when an email
is sent but the record of it can't be saved, the sentence names the
recipient (`email.server.ts:333`). The text of an outside service's error
is stored beside the sentence, and that can name an address too.

These are stored in `import_runs.problems` for a month, and in
`errors_seen`. Erasing a supporter clears neither. `docs/data-protection.md`
says `errors_seen` may hold personal data by accident, but doesn't mention
`import_runs.problems` at all.

### 6. One broken panel takes down the whole page

The app has a single error page, `app/global-error.tsx`, and no `error.tsx`
in any folder below it. So if one part of a staff page throws while it
renders, the whole page is replaced, including the menu. The same happens
to a form when its Server Action throws.

### 7. A save that fails looks like a save still in progress

Several components call a Server Action and wait for it without catching a
failure. In `EmailSettings.tsx:493`, if the request fails, the form shows
"saving" for good. A search found the same shape in `AnswerableReply.tsx`,
`NoteChanges.tsx`, `MailingWriter.tsx` and `BroadcastWriter.tsx`. Only the
first has been read closely, so check each of the others as it's fixed.

### 8. Calls to outside services have no time limit

`outsideFetch` sets no timeout. Only two callers set their own (the Luma
guest list and link previews). If any other service stops answering, the
job waits until Netlify stops the function at 30 seconds. The job never
reaches the code that records the run, so nothing is stored and nobody is
told.

### 9. Four places decide what to do by reading an error's text

- `inactiveAddresses()` (`email.server.ts`) pulls addresses out of
  Postmark's error message with a regular expression.
- `aliases.server.ts:167` looks for "quota" or "rate" in Gmail's message to
  spot a rate limit.
- `luma-calendar.server.ts:224` looks for "couldn't find that contact" in
  Luma's message.
- `luma-guests.server.ts:231` checks the error's name is `"TimeoutError"`.

If a service rewords a message, the code silently takes the wrong path.

### 10. Every outside service reports failure differently

Six services have their own error class, each with different fields.
`GmailError` has a status and a `revoked` flag, `PostmarkError` has an
`inactive` flag, and `CivicrmRequestError` has nothing. Five others
(Parliament, Wikidata, the devolved bodies, ControlAI, postcodes.io) throw
a plain `Error` whose message is `"<url> returned <status>"`. Some
functions don't throw at all, and return `null`, an empty list, or an
object holding a sentence.

So a caller can't ask a simple question such as "was that a rate limit?"
or "is it worth trying again?" in the same way for two services. Only
`email.server.ts` works this out (`accountsFault`), and only for Gmail and
Postmark. Only Parliament's code retries.

### 11. Forms are told about failure in many different ways

- Three server functions return the finished English for the visitor, so
  the wording is chosen deep in server code: `turnstile.server.ts`,
  `mp-letters.server.ts` and `checkMarchRegistration`. The contact
  preferences form shows spam-check messages that belong to the
  email-your-MP tool's copy.
- Staff actions report back in at least five ways: a typed result, a
  boolean, a redirect with `?notice=`, `undefined`, or nothing. The
  `staff-actions-one-pattern` investment describes this.
- In about 19 places a staff action returns without doing anything when
  its input doesn't parse. Nothing is shown and nothing is recorded.

### 12. Errors are stored as text

`import_runs.error`, `luma_events.guests_error`, `luma_events.hosts_error`
and `mailings.wait_said` each hold the text of an error. Nothing can tell
"Luma rate-limited us" from "Luma was down" without reading that text.

### 13. The same error handling is written out many times

- About 27 places do the same thing: try a call to an outside service, and
  on any error report it and return an empty value.
- 11 places handle the two things that can go wrong around a send ("not
  sent, so put it back in the queue" and "sent, but the record wasn't
  saved"). Each is written by hand for letters, relays, answers, mailings
  and broadcasts.
- 7 places report a heading and then a list joined with commas.

### What already works

Some of the code already uses codes and not sentences, and the plan copies
it: `QueueReason`, `ScheduleResult`, `SaveResult`, `MarchRegisterResult`,
`EraseLeftover`, `WHATSAPP_ERRORS`, and the flags on `SendResult`. The
Errors page already identifies a Postgres error by its code.

## The changes

### A. Give every problem a code

This fixes problems 1 and 5, and most later changes build on it.

Today a call looks like this, and the sentence is what's stored:

```ts
problem(emailCopy.problems.notSentYet(lettersCopy.problems.letterOf(letter.id)), error);
// stored: { what: "<a sentence naming letter 4127>", error: "fetch failed" }
```

After the change, what's stored is a code, the details, and the outside
service's own text:

```ts
// stored: { code: "letters.notSentYet", values: { letter: 4127 }, said: "fetch failed" }
```

`alertIfNew` then compares codes, so letter 4128 failing for the same
reason is the same problem. The job's page and the alert email turn the
code and details into a sentence when they're shown. Rows stored before
the change still show their old sentence.

**Decided: each feature declares its own problems.** A feature's copy file
declares its problems once. Each becomes a function to call:

```ts
// lib/letters/copy.ts (the sentence here is only an illustration)
export const letterProblems = defineProblems("letters", {
  notSentYet: (p: { letter: number }) => `Letter ${p.letter} wasn't sent and is back in the queue`,
});

// where it goes wrong
letterProblems.notSentYet({ letter: letter.id }, error);
```

The code (`letters.notSentYet`) comes from the feature's name and the
problem's name, so nobody types it as a string. TypeScript checks the
details at every call. The sentences stay beside the feature's other copy,
where they are now.

**A rule for the details.** The details are IDs, counts and codes, never a
private person's name or address. TypeScript enforces this through the type
of `values`. The page or email looks a supporter up from their ID when it's
shown. That way nothing personal is stored with a problem, and erasing a
person needs no extra step.

**Decided: public text is allowed.** A politician's name is public, so it
may be a detail. So may a few things that can't be looked up later, such
as the name of a character set. Each goes through a named wrapper that
marks it as public, so a reviewer can see every place it's used.

### B. Where a job's failures are recorded

**Decided: a job that crashes stays in both places**, on its run and on
the Errors page (problem 2). Two small fixes make the code and the docs
agree with that:

- `runJobNow` throws the crash on, or reports it, so a run staff started
  reaches the Errors page as a scheduled one does.
- `docs/domain-concepts.md` says a crash is recorded in both places, and
  why.

**Turned down: merging the two records into one.** Problems a job handles
stay on its run, and everything else stays in `errors_seen`. A single
record would hold one copy of each problem's details, overwritten each
time it happens, so a run would still need its own copy to show what went
wrong on that run. It would also change how often staff are emailed about
a job that stays broken, from once to once a day.

### C. One error type for outside services

This fixes problems 8, 9 and 10.

**Decided: a shared error class, `OutsideFailure`.** Every outside
service's code throws this class, or its own subclass of it. It has the
same fields whichever service failed:

| Field         | What it holds                                                                              |
| ------------- | ------------------------------------------------------------------------------------------ |
| `service`     | Which service, such as `"luma"`                                                            |
| `kind`        | One of `unreachable`, `timeout`, `refused`, `rate-limited`, `unauthorised`, `not-found`    |
| `status`      | The HTTP status, or 0 if there was no answer                                               |
| `serviceCode` | The service's own error code, where it has one (Postmark's `ErrorCode`, WhatsApp's `code`) |
| `said`        | The service's own message, cut short                                                       |
| `retryAfter`  | How long to wait, where the service says                                                   |

Each service's code works out `kind` in one place, from the status and the
service's own code. Callers then ask `error.kind === "rate-limited"` and
never read a message. The existing classes (`GmailError`, `PostmarkError`
and the rest) become subclasses, so the code that checks for them keeps
working while callers are moved over one at a time.

Three more things come with it:

- `outsideFetch` gets a default time limit for each service. A call that
  runs out of time throws an `OutsideFailure` with kind `timeout`.
- `outsideFetch` gets an optional retry for requests that are safe to
  repeat. This is the loop Parliament's code already has, moved to where
  every service can use it.
- The four text checks in problem 9 move inside the service's own code,
  which sets a typed field. Callers read the field.

Functions keep throwing their failures. The alternative, where every
function returns either a result or a failure object, was turned down. It
would mean rewriting every call, and Next's own docs say to throw for
unexpected errors
(`node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md`).

One thing isn't known. Postmark may give the list of inactive addresses
only inside its message text and nowhere else. Its error codes are
documented at https://postmarkapp.com/developer/api/overview#error-codes.
If the message is the only source, the regular expression stays, inside
Postmark's code, with a test using a message as Postmark really sends it.

### D. Shared helpers for the repeated code

This fixes problem 13. **Decided: all three helpers.** Each can be its own
PR.

- **A helper for "try it, and fall back if the service fails".** It
  replaces about 27 hand-written `try`/`catch` blocks. It catches only an
  `OutsideFailure`, reports it, and returns the fallback value. Any other
  error is thrown on. That's a deliberate change. Today those blocks catch
  everything, so a bug in our own code gets reported as "Luma is down".
- **A helper for the two failures around a send.** One function handles
  "not sent, put it back" and "sent, but not recorded" for letters,
  relays, answers, mailings and broadcasts. It replaces 11 hand-written
  copies.
- **A problem whose detail is a list.** It replaces the 7 places that join
  a list with commas. The job's page can then show the list as a list.

### E. One way for forms to report failure

This fixes problem 11.

**Decided: one result shape, with codes.** Every form's server code, for
visitors and staff alike, returns one of two shapes:

```ts
{ ok: true, … }
{ ok: false, reason: "postcode-not-found", fields?: { email: "invalid" } }
```

`reason` and the per-field values are codes. The component that shows the
form looks up the English in its own feature's copy. The server functions
in problem 11 return codes and no sentences. For staff actions this is what
the `staff-actions-one-pattern` investment already proposes, so the two are
done together.

The checks on a form's input stay hand-written. A validation library such
as Zod was turned down. Only the march sign-up needs an error for each
field, and a library's own error codes would still need mapping to ours.

**Decided: what a staff action does with input it can't use.** In about 19
places a staff action quietly does nothing when its input doesn't parse.
Those are three different things, and each is handled in its own way:

- **A field our own form fills in arrives missing or malformed**, such as
  a mailing's `id` that isn't a number. Staff can't cause this by typing,
  so it's a bug in the form or a forged request. The action throws, and it
  lands on the Errors page.
- **Staff typed something the form can't take**, such as a filter's name
  that's only spaces, or a time that isn't one. The action returns a
  reason, and the form says what's wrong.
- **The thing has gone since the page loaded**, such as a filter someone
  else deleted. The action returns a reason, and the form says so.

Each of the 19 is sorted into one of these as its action is converted.

**A public form never throws on bad input.** Bots post anything at pages
such as `/campaigns`, and a failed Turnstile check is the form working,
not a bug. Bad input to a visitor's form gets a reason back, or is dropped
as now, and isn't recorded as an error.

The routes that only machines call, such as webhooks, can stay as they
are. Nobody reads their error text.

### F. Store errors as a code and details

This fixes problem 12, and follows from A and C.

**Decided: replace each text column with a JSON column.** It holds the
same shape as a problem, `{ code, values, said }`. Four columns change:

| Table         | Column         | What it holds today                             |
| ------------- | -------------- | ----------------------------------------------- |
| `import_runs` | `error`        | Why a job's run failed                          |
| `luma_events` | `guests_error` | Why the last fetch of an event's guests failed  |
| `luma_events` | `hosts_error`  | Why the last fetch of an event's hosts failed   |
| `mailings`    | `wait_said`    | What CiviCRM said when a broadcast had to wait  |

The migration adds the new columns and leaves the old ones in place, so
rows already stored can still be shown.

`import_runs.problems` is already JSON, so it needs no migration. Its
contents change shape under A, and old rows keep the old shape.

### G. Error pages, and saves that fail

This fixes problems 6 and 7.

**Decided: all three parts.**

- **An `error.tsx` for each section of the site**: `(site)`, `(staff)`,
  `(march)` and `(tools)`, sharing one component. When something throws,
  the layout and menu stay and only the content is replaced, with a button
  to try again. The staff one links admins to the Errors page. Next
  documents this in
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`.
- **Protection for individual panels on staff pages.** Next's `catchError`
  function
  (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/catchError.md`)
  puts the same protection around one component. It's for the few panels
  that call an outside service while the page renders, so one of those can
  fail by itself and leave the rest of the page working.
- **One hook for saving.** A `useSave` hook wraps a call to a Server
  Action. It tracks whether the save is in progress, has finished or has
  failed, and reports anything thrown. The components in problem 7 use it
  in place of their own state, so a failed save says it failed. It's the
  browser half of E, and the same hook the `staff-actions-one-pattern`
  investment asks for.

The storyboard needs a way to fail on purpose, since fixture data never
fails. A route that throws and an action that fails, both only in fixture
builds, let a flow show an error page and a failed save. They're built once,
with the first of these, and every later flow about an error reuses them.

### H. Enforcement, added at every step

**Decided: every step turns on its own rules, in the same PRs as the
change.** The aim is that code written later can't drift back, even when
whoever writes it has never read this plan. So no step is finished until
the rule that holds it in place is on.

Three things make that work:

- **Each rule uses the strongest tool that can express it.** A type is
  best, as the code won't compile. ESLint is next, as it runs in the commit
  hook and the editor as well as the gate. A check in `tests/checks/` is
  for what neither can express.
- **A rule is on from the first PR of its step.** Where a step converts the
  code a part at a time, the rule starts with a list of the files not yet
  converted, as `UNCONVERTED_DOM_EDITS` in `eslint.config.mjs` does. Each
  later PR takes its files off the list. The step is finished when the
  list is empty and deleted.
- **Every failure message says what to do instead**, naming the helper to
  use. That's how someone who doesn't know the rule finds it out.

Which rules go with which step is in "Order of work", below.

No rule can check judgement: whether the right `kind` was chosen, whether
an error should have been caught at all, or whether a sentence is right.
For that, `AGENTS.md` gets a short "Errors" section naming the helpers, and
`docs/code-structure.md` ("Errors") is kept up to date at every step.

## Order of work

The work is three PRs, each a group of steps. Within a PR, each commit is
one readable unit that passes the fast checks, such as one feature or one
service converted, and the PR passes the gate. Sentences that have already
been reviewed are moved as they are and checked with the reviewer. Any new
wording is a placeholder. Each step lists what it does, then the rules that
hold it in place (H).

## PR 1: the bugs, the general rules, error pages and saving

Steps 1 and 2. Neither depends on the rest. They go together because step
1 makes some failures throw where they were hidden before, and step 2's
error pages mean a throw keeps the page's menu. This PR needs new wording
for the error pages and for a save that failed, so it merges once that's
written.

### Step 1. The bugs that can be fixed straight away

- `runJobNow` hiding a crash from the Errors page, and the sentence in
  `docs/domain-concepts.md` that says a crash isn't recorded there (B).
- `unblockAddress` hiding its failure.
- A default time limit in `outsideFetch` (part of C).

Enforced by:

- **Both existing checks read all the server code under `app/`**, not only
  `app/api`. They fail on the three places in problem 3 until those are
  fixed.
- **No `console` at all in server code** (ESLint's `no-console`). This
  replaces the check for `console.error`, and can't be got round with
  `console.warn`. Information that isn't a failure goes through one small
  logging function, in the only file allowed to use `console`. So do the
  two deliberate warnings in problem 4.
- **An error can't be dropped into a sentence.**
  [`restrict-template-expressions`](https://typescript-eslint.io/rules/restrict-template-expressions/)
  and [`no-base-to-string`](https://typescript-eslint.io/rules/no-base-to-string/)
  fail on `${error}`. They go by type. The check they replace goes by the
  variable's name, so it misses an error called anything but `e`, `err` or
  `error`.
- **A rethrown error keeps its cause**
  ([`preserve-caught-error`](https://eslint.org/docs/latest/rules/preserve-caught-error)).
- **Every `switch` handles every case**
  ([`switch-exhaustiveness-check`](https://typescript-eslint.io/rules/switch-exhaustiveness-check/)).
  When a later step adds a new code, lint fails at each place that must
  handle it.
- **Four more rules that need type information**
  (https://typescript-eslint.io/rules/): `only-throw-error`,
  `prefer-promise-reject-errors`, `use-unknown-in-catch-callback-variable`
  and `no-misused-promises`. The last is what the `promises-as-values`
  investment asks for.

How many existing lines these ESLint rules flag isn't known yet. If a rule
flags many, it starts with a list of files not yet converted.

### Step 2. Error pages and the saving hook (G)

These don't depend on anything else. They change what people see, so they
need storyboard flows showing a page that fails, a panel that fails and a
save that fails.

Enforced by:

- **Every section of the site has an `error.tsx`** (a check), so a new
  section can't be added without one.
- **A Server Action is only called through `useSave`, `useActionState` or
  a form's `action`** (a check). That stops a bare `await save()` with no
  handling of failure. It starts with a list of the components not yet
  moved onto the hook.

## PR 2: the server side

Steps 3 and 4. It has no migration and no new wording, so nothing holds it
up. It's pushed as a draft once letters is converted, for the design to be
checked before the rest is.

### Step 3. Problems by code (A)

Convert one feature first, letters, with its send helper from D, and show
the reviewer the design before converting the rest. Then one feature per
commit. `docs/data-protection.md` is updated to say what a run stores.

Enforced by:

- **A problem's details can't be plain text** (a type). The type accepts
  numbers and fixed codes and rejects a plain `string`, which is what an
  address or a name is. Public text, such as a politician's name, goes
  through a named wrapper, which a reviewer can spot.
- **`problem()` can't be imported** outside the file that defines
  `defineProblems` (ESLint), so nobody can report a free-form sentence. It
  starts with a list of the features not yet converted.
- **Every problem a feature declares is used somewhere** (a check).

### Step 4. The shared error type for outside services (C)

One service per commit, with the fallback helper from D.

Enforced by:

- **An outside service's code can't `throw new Error(…)`**, only an
  `OutsideFailure` (ESLint). It starts with a list of the services not yet
  converted.
- **Nothing reads a caught error's text** (a check). It fails on
  `as Error`, and on `.message` or `.name` read from a caught error,
  anywhere outside the outside services' own code.
- **A `catch` is only allowed in files on a short list** (a check). Once
  the helpers from D exist, few files need their own. The list starts as
  every file that has a `catch` today, and shrinks as each moves to a
  helper. A new `catch` anywhere else fails until it's added with a
  reason, which shows up in review.

## PR 3: stored errors and forms

Steps 5, 6 and 7. The migration is here on purpose. A pushed migration
can't be edited, and by now PR 2 has settled the shape that's stored.

### Step 5. Stored errors (F)

The migration adds the four JSON columns. It carries the `migration`
label.

Enforced by:

- **`describeError()` can't be imported** outside the code that reports
  problems and records errors (ESLint), so an error's text can't be
  written to a new column.

### Step 6. Form results (E)

One form per commit, visitors' forms first.

Enforced by:

- **Every Server Action returns the one result shape**, or redirects (a
  check). It starts with a list of the actions not yet converted. The
  `staff-actions-one-pattern` investment asks for the same check.
- **A reason is a code, not a sentence** (a type).
- **A staff form's own fields are read by helpers that throw**, such as
  one for a record's `id`. An action can't then forget to check, or return
  quietly.
- **`fetch` is banned in browser code** outside one shared helper, which
  checks the response's status (ESLint). Server code already has this
  rule.

### Step 7. Finish

Every list of files not yet converted is empty and deleted. `AGENTS.md`
has its "Errors" section.

Delete this plan when step 7 is done.
