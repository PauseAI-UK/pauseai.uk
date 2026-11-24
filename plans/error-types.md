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

## Status

Each part of this plan is marked **DONE** or **TO DO**. A part marked DONE
is in the code, with the PR that did it, and is kept here only so the rest
makes sense: don't do it again.

| PR                                                      | Steps      | Status             |
| ------------------------------------------------------- | ---------- | ------------------ |
| PR 1: the bugs, the general rules, error pages, saving  | 1 and 2    | **DONE** in #462   |
| PR 2: the server side                                   | 3 and 4    | **TO DO**          |
| PR 3: stored errors and forms                           | 5, 6 and 7 | **TO DO**          |

Of the problems below, 2, 3, 4, 6, 7 and 8 are DONE. Problems 1, 5, 9, 10,
11, 12 and 13 are TO DO.

## Before starting PR 2

For whoever picks this up without having done PR 1.

**Where to work.** The branch `error-handling-server-side`, in
`tmp/worktrees/error-handling-server-side`.

**What was settled with letters and mailings converted**, which the rest
follows:

- **The sentence is kept beside its code.** A problem is stored as
  `{ code, values, what, said }`: `what` is the sentence, written as the
  problem is reported, and it's what the job's page, the run's alert and
  the Errors page show. The code is what's compared. So there's no list of
  every feature's problems for the readers to look a code up in. A
  reworded sentence shows its old words on rows already kept. Values are
  IDs, counts and fixed codes, so nothing personal is in a sentence.
- **Declaring is apart from reporting.** `defineProblems()` is in
  `lib/problems.ts`, which anything can import, and makes each problem a
  function that says it happened: its code, values and sentence. Reporting
  that is `problem()`'s, on the server:
  `problem(letterProblems.copyNotSentYet({ letter: id }), error)`. The
  declared function doesn't report by itself, as the plan's example had
  it, because the copy file is loaded by the browser too, and what keeps
  a problem on its run is found by the server's own modules.
- **The type that keeps plain text out** is `SafeValue` there: a value
  typed `string` is `never`, a fixed code is allowed, and text goes
  through `publicText()`, or `outsideId()` for an outside service's ID.
- **While features are converted**, the old reporter is
  `problemInWords()`, and `tests/checks/declared-problems.test.ts` lists
  the files that may still import it (`UNDECLARED`). A check, not ESLint:
  the per-file lists in `eslint.config.mjs` replace one another, so a
  list of files across them can't be added. Each feature's commit takes
  its files off, and the last deletes `problemInWords()` and the list,
  after which the type of `problem()` is the rule.
- **The send helper** is `sendWithCare()`
  (`lib/email/send-with-care.server.ts`), and `sendLetterVia()` is built
  on it. `SentUnrecorded` and `NotSentYet` are gone.

**What needs no migration.** `import_runs.problems` is JSON already, and a
reader takes both shapes: an old row has `what` and `error`, a new one
`code`, `values`, `what` and `said`.
`errors_seen` has a `code` column and keys a row by it alone when it's
told to (`byCode` in `lib/oversight/errors-seen.server.ts`, as for a
Postgres error), so a problem's code goes there.

**What PR 1 left that PR 2 meets:**

- `keepCaught()` and `note()` are reporters beside `problem()`. The checks
  know them (`REPORTERS` in `caught-errors.test.ts`, `ONLY_NOTED` in
  `problem-reporting.test.ts`).
- `outsideFetch`'s time limit throws the browser's `TimeoutError`, which
  step 4 turns into an `OutsideFailure`. `luma-guests.server.ts` tells one
  by its name today.
- `fieldText()` (`lib/server/json.server.ts`) says a field of an API's
  answer as text, for a refusal's words.

**How the work went in PR 1, to save finding out again:**

- `npm run test:changed` stops at once in a worktree
  (`investments/test-changed-in-worktrees.md`). Use
  `npm run gate -- --only test`.
- A change to `problems.server.ts` or anything every flow reaches runs
  every flow in the gate: about 20 minutes. Run the affected test files
  by hand while working, and the gate at the end.
- To see a test fail on the code as it was, put the old file back for one
  run (`git show HEAD:<path> > <path>`), then restore the new one.
- To see what a lint rule flags before adopting it, add it to the typed
  block of `eslint.config.mjs` and lint to a JSON file
  (`investments/trying-a-lint-rule.md`).
- If CI's coverage fails on a file that passes here, see
  `investments/ci-coverage-here.md`.

The survey of the code this plan was written from is at the end ("What the
survey found").

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

Two tests enforce the second rule, in all the server's code
(`tests/checks/server-code.ts`). `tests/checks/caught-errors.test.ts` fails
on a `catch` that neither rethrows nor reports. `problem-reporting.test.ts`
fails on a failure that's only written to the log. ESLint keeps `console`
out of the site's code altogether: what isn't a failure is logged with
`note()`, beside `problem()`.

This design is sound, and the plan keeps it. The weakness is in what gets
recorded, and in a few places the rules don't reach.

## Problems found

Each was found by reading the code. None has been reproduced yet, so each
gets a failing test before its fix.

### 1. Staff are emailed again about a problem they already know about: TO DO

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

### 2. A job that crashes is reported in two places: DONE in #462

**DONE in #462.** It stays in both places, as decided. A run staff started now keeps its crash too, with `keepCaught()`, and `docs/domain-concepts.md` says so. What follows is the problem as it was found.

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

### 3. The tests that enforce the rules skip the staff pages: DONE in #462

**DONE in #462.** Both tests read every route handler, page, layout and file of Server Actions under `app/`. The three places below are fixed. What follows is the problem as it was found.

Both tests read `lib/`, `app/api` and `netlify/functions`. They don't read
`app/(staff)/`, which holds every staff Server Action. Three caught errors
there are written to `console.error`, which only reaches Netlify's logs:

- `unblockAddress` (`oversight/actions.ts`). If Postmark can't be reached,
  the address stays blocked and staff are shown nothing.
- The Gmail connection callback (`staff/api/gmail/callback/route.ts`). It
  also writes the staff member's email address to the log.
- `runJobNow` (`jobs/actions.ts`). This one does no harm, because the run
  has already recorded the failure.

### 4. A warning gets past the check: DONE in #462

**DONE in #462.** `console` is banned by ESLint, and a failure handed to `note()` fails a test unless it's listed with its reason. The two below are listed. What follows is the problem as it was found.

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

### 5. Personal data ends up in the stored problems: TO DO

Sentences can contain an email address. One does for certain: when an email
is sent but the record of it can't be saved, the sentence names the
recipient (`email.server.ts:333`). The text of an outside service's error
is stored beside the sentence, and that can name an address too.

These are stored in `import_runs.problems` for a month, and in
`errors_seen`. Erasing a supporter clears neither. `docs/data-protection.md`
says `errors_seen` may hold personal data by accident, but doesn't mention
`import_runs.problems` at all.

### 6. One broken panel takes down the whole page: DONE in #462

**DONE in #462.** Every layout has an `error.tsx` beside it, and a test fails on one without. What follows is the problem as it was found.

The app has a single error page, `app/global-error.tsx`, and no `error.tsx`
in any folder below it. So if one part of a staff page throws while it
renders, the whole page is replaced, including the menu. The same happens
to a form when its Server Action throws.

### 7. A save that fails looks like a save still in progress: DONE in #462, but for four components

**DONE in #462**, with the `useSave` hook, for the contact preferences form, a reply's answer and reactions, a note's edit and the politicians list's tick boxes. **TO DO:** the four components in `UNCONVERTED_SAVES` (`eslint.config.mjs`), which move in step 6. What follows is the problem as it was found.

Several components call a Server Action and wait for it without catching a
failure. In `EmailSettings.tsx:493`, if the request fails, the form shows
"saving" for good. A search found the same shape in `AnswerableReply.tsx`,
`NoteChanges.tsx`, `MailingWriter.tsx` and `BroadcastWriter.tsx`. Only the
first has been read closely, so check each of the others as it's fixed.

### 8. Calls to outside services have no time limit: DONE in #462

**DONE in #462.** `outsideFetch` gives up after `OUTSIDE_TIMEOUT_MS` (20 seconds) unless the call sets its own limit. What follows is the problem as it was found.

`outsideFetch` sets no timeout. Only two callers set their own (the Luma
guest list and link previews). If any other service stops answering, the
job waits until Netlify stops the function at 30 seconds. The job never
reaches the code that records the run, so nothing is stored and nobody is
told.

### 9. Four places decide what to do by reading an error's text: TO DO

- `inactiveAddresses()` (`email.server.ts`) pulls addresses out of
  Postmark's error message with a regular expression.
- `aliases.server.ts:167` looks for "quota" or "rate" in Gmail's message to
  spot a rate limit.
- `luma-calendar.server.ts:224` looks for "couldn't find that contact" in
  Luma's message.
- `luma-guests.server.ts:231` checks the error's name is `"TimeoutError"`.

If a service rewords a message, the code silently takes the wrong path.

### 10. Every outside service reports failure differently: TO DO

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

### 11. Forms are told about failure in many different ways: TO DO

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

### 12. Errors are stored as text: TO DO

`import_runs.error`, `luma_events.guests_error`, `luma_events.hosts_error`
and `mailings.wait_said` each hold the text of an error. Nothing can tell
"Luma rate-limited us" from "Luma was down" without reading that text.

### 13. The same error handling is written out many times: TO DO

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

### A. Give every problem a code: TO DO

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

### B. Where a job's failures are recorded: DONE in #462

**Decided: a job that crashes stays in both places**, on its run and on
the Errors page (problem 2). Two small fixes made the code and the docs
agree with that:

- `runJobNow` keeps the crash with `keepCaught()`
  (`lib/oversight/errors-seen.server.ts`), so a run staff started reaches
  the Errors page as a scheduled one does, and its page still refreshes to
  show the failed run.
- `docs/domain-concepts.md` says a crash is recorded in both places, and
  why.

**Turned down: merging the two records into one.** Problems a job handles
stay on its run, and everything else stays in `errors_seen`. A single
record would hold one copy of each problem's details, overwritten each
time it happens, so a run would still need its own copy to show what went
wrong on that run. It would also change how often staff are emailed about
a job that stays broken, from once to once a day.

### C. One error type for outside services: TO DO, but for the time limit

This fixes problems 9 and 10. Problem 8 is DONE: `outsideFetch` has one
default time limit for every service (#462).

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

- `outsideFetch` has a default time limit already (`OUTSIDE_TIMEOUT_MS`).
  **TO DO:** a call that runs out of time throws an `OutsideFailure` with
  kind `timeout`, where now it's the browser's `TimeoutError`. A limit of
  its own for a service that needs one goes in with its conversion.
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

### D. Shared helpers for the repeated code: TO DO

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

### E. One way for forms to report failure: TO DO

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

### F. Store errors as a code and details: TO DO

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

### G. Error pages, and saves that fail: DONE in #462

This fixed problems 6 and 7. What was built:

- **An `error.tsx` beside every layout.** `ErrorMain`
  (`components/layout/`) on the public pages, the tools and the march
  sign-up, and `StaffError` beside the staff navigation. Each says the page
  went wrong and offers to load it again. `tests/checks/error-pages.test.ts`
  fails on a layout without one.
- **One hook for saving, `useSave`** (`components/ui/`). It runs a save in
  a transition, says when it failed, and tells the site of what the browser
  threw. `useSavedChoice`, beside it, is for a tick box or a switch: it
  shows the choice at once and puts it back if the save fails. Something
  typed keeps what was typed (`docs/code-structure.md`, "Errors"). ESLint refuses an async function written in place as an event's
  handler or handed to a transition (`SAVE_RULES`).
- **Storyboard flows** for a staff page that breaks, a public page that
  breaks, and a change that doesn't save. A flow makes a save fail by
  dropping its request in the browser (`page.route`), so no route that
  fails on purpose was needed.

Two things differ from what was planned:

- **No protection for single panels.** No staff panel calls an outside
  service while its page renders and can throw: they all fall back
  already. When one does, Next's `catchError`
  (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/catchError.md`)
  is the tool.
- **Four components aren't on the hook yet**: the mailing and broadcast
  writers, the draft writer and the sign-up import
  (`UNCONVERTED_SAVES`). Each handles a failed save in its own way. They
  move in step 6, when their actions change shape. **TO DO.**

### H. Enforcement, added at every step: step 1's and step 2's DONE in #462

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

## PR 1: the bugs, the general rules, error pages and saving: DONE in #462

Steps 1 and 2. Don't do these again. What follows says what was built, and
where it differs from what was planned, for whoever does PR 2 and PR 3.

### Step 1. The bugs that could be fixed straight away: DONE

- A run staff started keeps its crash as an error (`keepCaught()`), and
  `docs/domain-concepts.md` says a crash is recorded in both places (B).
- `unblockAddress` throws when the provider can't be reached.
- A Gmail connection Google won't complete is reported as a problem.
- `outsideFetch` has a default time limit (part of C).

Enforced by:

- **Both checks read all the server's code**
  (`tests/checks/server-code.ts`): every route handler, page, layout and
  file of Server Actions under `app/`, as well as `lib/`.
- **No `console` in the site's code** (`CONSOLE_RULE` in
  `eslint.config.mjs`). What isn't a failure is logged with `note()`, and a
  failure handed to `note()` fails `problem-reporting.test.ts` unless it's
  listed there with its reason.
- **ESLint rules that need the types** (`TYPED_RULES` and
  `TYPED_SITE_RULES`): `no-floating-promises`, `no-misused-promises`,
  `switch-exhaustiveness-check`, `only-throw-error`,
  `prefer-promise-reject-errors`, `use-unknown-in-catch-callback-variable`
  and `restrict-template-expressions`, with `preserve-caught-error`.

Three things differ from what was planned:

- **`no-base-to-string` was left out.** All 43 lines it flagged were form
  fields and request bodies, none an error. The check for `String(error)`
  by the variable's name stays.
- **`no-misused-promises` leaves out event handlers and props.** It flagged
  39, most of them functions that catch what they throw. `SAVE_RULES`
  covers the case that matters, a save with nothing to catch its failure.
- **A `switch` with a `default` counts as handling every case.**

### Step 2. Error pages and the saving hook (G): DONE

See G, above, for what was built and what differs.

Enforced by:

- **Every layout has an `error.tsx` beside it**
  (`tests/checks/error-pages.test.ts`).
- **A save from an event goes through `useSave`** (`SAVE_RULES`, with
  `UNCONVERTED_SAVES` for the four components still to move). This is in
  place of the planned check that a Server Action is only called through
  the hook: a component is handed its actions as props, so nothing can
  tell which calls are Server Actions.

## PR 2: the server side: TO DO

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

## PR 3: stored errors and forms: TO DO

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

One form per commit, visitors' forms first. The four components in
`UNCONVERTED_SAVES` move to `useSave` here, as their actions change shape,
and the list is deleted.

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

## What the survey found

From reading the code on 23 Nov 2026, before PR 1. Line numbers will have
moved, so each is given by its file and what it does. Search again before
relying on a count.

### The calls to `problem()`

About 84, in these copy files' `problems` blocks: `lib/server/copy.ts`
(`problems.anywhere` and `problems.logs`), and the `copy.ts` of
`lib/letters`, `lib/broadcasts`, `lib/email`, `lib/supporters`,
`lib/events`, `lib/jobs` and `lib/politicians` (which also has six under
`politicianImports`), with `lib/erasure/copy.ts` for an erasure's
leftovers.

**The ones with something that varies in the sentence**, which step 3 turns
into values:

- A letter's, relay's, answer's or broadcast copy's ID, through a namer
  (`letterOf`, `letterCopyOf`, `relayOf`, `answerTo`, `copyOf`), inside
  `emailCopy.problems.notSentYet()` and `sentUnrecorded()`: in
  `lib/mailings/sending.server.ts`, `lib/letters/sending.server.ts`,
  `lib/letters/relays.server.ts`, `lib/broadcasts/answers.server.ts` and
  `lib/broadcasts/sending.server.ts`. These are the 11 that D's send
  helper replaces.
- An event's ID: `eventGuests()` and `eventHosts()` in
  `lib/events/luma-import.server.ts`, and an event's name in
  `lumaTagRefused()` (`lib/events/tagging.server.ts`).
- A count: `civicrmUpdatesUnanswered()` and `civicrmUpdatesInvalid()` in
  `lib/supporters/civicrm-updates.server.ts`.
- A politician's name: `keptSalutation()`, `misspeltSalutation()` and
  `missingHonour()` in `lib/politicians/imports.server.ts`, once for each
  politician in a loop. These are public, so they go through the wrapper
  for public text.
- An address, which is personal and must become an ID or go:
  `sentUnrecorded()` with the recipient in `lib/email/email.server.ts`,
  `addressNotSearched()` in `lib/politicians/aliases.server.ts`.
- A staff member's Gmail account: `tokenNotRevoked()` in
  `lib/email/gmail-accounts.server.ts`, `nameUnknown()` and `couldntRead()`
  in `lib/jobs/gmail-reading.server.ts`, and `sendFailed()` with the
  account in `lib/email/email.server.ts`.
- A template's name: three in `lib/broadcasts/drafts.server.ts`. A
  character set: `charsetUnknown()` in `lib/email-parsing/mime.server.ts`.

**The ones whose second argument isn't a caught error**, about 14: a list
joined with commas after a heading (`twoMps`, the two `unmatched`,
`civicrmUpdatesInvalid`), a count or a comparison as text
(`civicrmTooFew`, `civicrmNumbersUnread`, `numbersUnread`,
`notUnderstood`), a status as a sentence (`"It answered 503"` in
`netlify-functions.server.ts`, Luma's status and body in
`luma-guests.server.ts`), and a message's ID (`unreadable` in
`lib/letters/one-off-emails.server.ts`). Two pass `error.cause`, in
`lib/mailings/sending.server.ts` and `lib/letters/sending.server.ts`.

**`told`** is passed in two calls only, both in
`lib/jobs/gmail-reading.server.ts`.

**The repeated shapes:** catch, report and return a fallback (about 27,
most in `lib/server/outside-services/`); the two failures around a send
(11); a heading then a list (7); report, then also store `describeError()`
(3: two in `luma-import.server.ts`, one in `broadcasts/sending.server.ts`).

### How each outside service fails

| Service                                                 | On a refusal                                                              | Notes                                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Luma's API (`luma-api.server.ts`)                        | Throws `LumaRateLimited { retryAfter }` on a 429, else `LumaRefused { status, lumaMessage }` | Reads `retry-after`. No retry                                          |
| Luma's calendar, guests, public page                    | Returns `[]` or `null` after `problem()`; `addLumaGuest` returns `{ status: "failed", reason }` | `removeCalendarContact` matches Luma's words for a contact not found   |
| Gmail (`gmail.server.ts`)                               | Throws `GmailError { status, revoked }`                                    | A 404 is an answer in three places                                     |
| Postmark (`postmark.server.ts`)                         | Throws `PostmarkError { inactive, status }`                                | Its `ErrorCode` is in the message; `email.server.ts` parses the addresses out |
| WhatsApp (`whatsapp.server.ts`)                         | `graph()` throws `WhatsAppRequestError { code, reason }`; a send returns `{ sent: false, code, reason }` | `WHATSAPP_ERRORS` sorts the codes                                      |
| CiviCRM (`civicrm.server.ts`)                           | Throws `CivicrmRequestError`, with no fields                               | A per-event result comes back as `{ status, reason }`                  |
| Parliament (`parliament.server.ts`)                     | Throws a plain `Error("<url> returned <status>")`                          | The only one that retries: five tries on a 429 or 503                  |
| Wikidata, the devolved bodies, ControlAI                | Throws a plain `Error("<url> returned <status>")`                          |                                                                        |
| postcodes.io (`postcodes.server.ts`)                    | A lookup returns `{ ok: false, reason }`; the bulk ones throw a plain `Error` |                                                                        |
| Stripe, Turnstile, link pages, Netlify's functions      | Return a fallback after `problem()`                                        | Turnstile returns finished copy (E)                                    |

Only `lib/email/email.server.ts` (`accountsFault`) sorts a failure into
"try later", "fix the account" and "may have gone", for Gmail and Postmark.

Other error classes: `SentUnrecorded` and `NotSentYet`
(`lib/letters/lifecycle.server.ts`), which D's send helper is built on, and
`ContactsPassFailed` (`lib/events/luma-import.server.ts`).

### How forms report failure

Thirteen files of Server Actions, about 70 actions, 12 of them staff's. The
shapes sent to the browser: `{ ok: false, message }` with finished copy
(the events place lookup, the MP lookup, the letters route); `{ ok: false,
reason, errors }` (the march's sign-up); typed results with a reason code
(`SaveResult`, `ScheduleResult`, `AnswerResult` and others); a boolean;
`undefined`; a redirect with `?notice=`; and a silent return on input that
doesn't parse, in about 19 places.

