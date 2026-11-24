# Catches a helper could replace

Size: S. Kind: small fix.

## Problem

About forty files where jobs and requests run still have a `catch` of their own, listed as `OWN_CATCHES` in `tests/checks/caught-errors.test.ts`. Some belong there: the helpers themselves, each outside service's binding, the database's connection, and those that catch more than an outside service failing, as the lookup of an MP from a postcode does (`lib/politicians/find-mp.server.ts`), which answers the visitor politely for the database failing too.

The rest only guard a call to an outside service, and do by hand what `orFallback()` does (`lib/server/outside-services/fallback.server.ts`): report the failure and carry on without it. Reading Luma's tags is one (`lib/events/tagging.server.ts`). A catch written by hand takes anything thrown inside it for the service failing, so a bug of ours there is reported as the service being down. `orFallback()` catches only an `OutsideFailure` and throws the rest on, to be kept as the bug it is.

How many are of that second sort isn't counted: about a dozen, from reading four.

## Fix

Go through `OWN_CATCHES` a file at a time. Where a catch only guards an outside service, use `orFallback()`, or `sendWithCare()` (`lib/email/send-with-care.server.ts`) for something a run has taken to send, with a test that a bug thrown inside is thrown on. Take the file off the list when its last catch goes. Where a catch has to stay, say why in a comment beside its line in the list.

## Hits

None yet.
