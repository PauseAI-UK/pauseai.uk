# A plural helper

Size: S. Kind: small fix.

## Problem

The staff copy writes each plural by hand, `n === 1 ? … : …`, 75 times in `lib/content/staff-interface.ts`. Each is two branches, so the coverage rule needs a test of each with 1 and with another number, and much of `staff-interface.test.ts` exists only for that, with assertions like `expect(x(1)).not.toBe(x(2).replace("2","1"))` that prove a branch ran, not that the words are right.

## Fix

A `plural(n, one, many)` helper on `Intl.PluralRules` (https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules), tested once. The copy calls it, and the per-plural tests go.

## Hits

None yet.
