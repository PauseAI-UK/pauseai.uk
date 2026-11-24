# An answer's body, read where its failing isn't the service's

Size: S. Kind: small fix.

## Problem

A binding's failures are `OutsideFailure`s, so that `orFallback()` can tell an outside service failing from a bug of ours (`docs/code-structure.md`, "Errors"). Two ways a service can fail still come out as a plain error, which `orFallback()` throws on as a bug, and a job's run fails for it:

- **An answer that's ok but isn't JSON, from Gmail.** `api()` and `gmailSendName()` read the body with `res.json()` (`lib/server/outside-services/gmail.server.ts`), where the other bindings use `outsideJson()` or a reader that takes anything. What reads Gmail mostly has a catch of its own that takes whatever is thrown, so nothing is known to break today.
- **A body that breaks off as it's read**, in any binding. `outsideFetch` turns a service that can't be reached, or doesn't answer in time, into an `OutsideFailure`, but only until the headers arrive. The connection dropping, or the time limit passing, while `res.text()` or `res.json()` reads the body throws a `TypeError` or a `TimeoutError`. This is from reading the code: it hasn't been made to happen.

## Fix

- Read Gmail's answers with `outsideJson("gmail", res)`, checking first what each caller does with a `GmailError` as against an `OutsideFailure`.
- Have `outsideFetch` hand back a response whose body's reading fails as an `OutsideFailure` too, or give the bindings one reader that does, so no binding reads a body bare. A test with a response that ends mid-body shows it.

## Hits

None yet.
