# Real error types

What went wrong is often carried around as one of our sentences, so code
can only tell failures apart by comparing or parsing text. Failures should
be typed values instead, with their words looked up only where a person
reads them.

## Where it goes wrong now

- `problem(what, error?)` (`lib/server/problems.server.ts`) keeps our
  finished sentence as `what`, and `alertIfNew` in
  `lib/server/import-runs.server.ts` compares those sentences with the run
  before's. So rewording a problem's copy alerts staff to a "new" problem.
  It's called all over the code, its second argument sometimes a caught
  error, sometimes a value we built.
- `inactiveAddresses()` in `lib/email/email.server.ts` gets the addresses
  by parsing Postmark's error message.
- `addLumaGuest` in `lib/server/outside-services/luma-guests.server.ts`
  casts `error as Error`, and returns its failure as a sentence in
  `reason`.
- `turnstile.server.ts` and `app/api/email-your-mp/letters/mp-letters.server.ts`
  return finished copy (`copy.errors.*`) as their result.
- `describeError()` flattens an error to text, kept in `import_runs.error`
  and `luma_events.guests_error` and `hosts_error`.

Already done well, to copy: `QueueReason`, `ScheduleResult`,
`MarchRegisterResult`, `GmailError`, `EraseLeftover` with `leftOver()`,
and `WHATSAPP_ERRORS` (`lib/broadcasts/whatsapp-texts.server.ts`), which
sorts WhatsApp's error codes. The errors page (`errors_seen`) keys a
Postgres error by its code, not its words.

## How

- An expected failure is a discriminated union with a code and typed
  values, so the compiler checks each is handled. One that callers tell
  apart when it's thrown is an error class with fields.
- The words come from the code where a person reads them: the alert
  email, the run's page, the form. Nothing stores, compares or parses our
  sentences.
- A caught `unknown` becomes something typed at the catch.
- What's stored is a code, its values, and an outside service's own error
  text, if any. Rows kept in the old shape (migrations `0078`–`0080`
  onwards) still show, by their sentence.
- Don't type what nothing tells apart, and let the truly unexpected throw.

## Steps

Each is its own PR and passes the gate. Show the reviewer the first's design,
with a few call sites converted, before converting the rest. Moving a
group of reviewed problem strings is checked with them first; new wording
is a placeholder.

1. **Problems by code.** `problem()` takes a code and its values; a run
   keeps those, and `alertIfNew` compares codes. This fixes the false
   alerts.
2. **Outside services.** Luma's guest adding, Turnstile and Postmark's
   inactive addresses return typed failures, Postmark's message parsed
   in one place inside its backend.
3. **Letters' API.** `mp-letters.server.ts` and the lookup return codes;
   the route or the form looks up the words.
4. **Stored errors.** `luma_events`' errors and `import_runs.error` keep
   a code and the raw text, not `describeError()`'s sentence.
5. **A check** in `tests/checks/` against `as Error` on a caught value,
   where types can't reach (`email.server.ts` has one too).
