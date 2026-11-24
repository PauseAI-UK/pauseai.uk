# Promises used as values

Size: S. Kind: small fix.

## Problem

A function that became async still type-checks where its result was used as a plain value: `Boolean(textSenderNumber())` was always true once `textSenderNumber` returned a promise, so a text with no WhatsApp number could have been scheduled. TypeScript allows it.

`@typescript-eslint/no-misused-promises` is on (`TYPED_SITE_RULES` in `eslint.config.mjs`), and catches a promise in an `if` or handed to something that takes none, such as a timer. Two cases get past it:

- A promise passed to `Boolean()`, or given a `?? ""` default.
- An async function passed as a prop typed to return nothing. The rule's check of props is off, as it flagged 39 event handlers, most of which catch what they throw. An inline async handler is refused by `SAVE_RULES`, but one passed by name isn't.

## Fix

Check whether `@typescript-eslint/strict-boolean-expressions` catches `Boolean(<promise>)` and the `??` default in the files where it matters, or add a `no-restricted-syntax` rule for `Boolean(<call>)` on an async function. For props, turn on the rule's check of attributes with a list of the files still to change, and wrap each named handler that needs no waiting in `() => void handler()`.

## Hits

- 2026-11-14: `Boolean(textSenderNumber())` after it became async, found only by a failing test, ~15 min
- 2026-11-13: an async Consent picker passed as `pick: (value: string) => void`, so a Server Action's redirect became an unhandled rejection that production reported as an error, ~30 min
