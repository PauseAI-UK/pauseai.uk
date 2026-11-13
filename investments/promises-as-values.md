# Promises used as values

Size: S. Kind: small fix.

## Problem

A function that became async still type-checks where its result was used as a plain value: `Boolean(textSenderNumber())` was always true once `textSenderNumber` returned a promise, so a text with no WhatsApp number could have been scheduled. TypeScript allows it, and `@typescript-eslint/no-floating-promises` only catches a promise that's dropped, not one that's used.

## Fix

Turn on `@typescript-eslint/no-misused-promises` beside `no-floating-promises` in `eslint.config.mjs`, and check whether it catches a promise passed to `Boolean()` or a `?? ""` default; if not, add `@typescript-eslint/strict-boolean-expressions` for those files, or a `no-restricted-syntax` rule for `Boolean(<call>)` on an async function.

## Hits

- 2026-11-14: `Boolean(textSenderNumber())` after it became async, found only by a failing test, ~15 min
