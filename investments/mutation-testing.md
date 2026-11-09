# Mutation testing on the core

Size: M. Kind: tools.

## Problem

Coverage shows a line ran, not that a test checked what it did. Some tests exist only to reach a branch, such as `lib/content/staff-interface.test.ts`'s `expect(x(1)).not.toBe(x(2).replace("2","1"))`.

## Fix

Stryker (https://stryker-mutator.io/docs/stryker-js/vitest-runner/), nightly and not part of the gate, on about ten core files: sending letters and mailings, matching supporters, Postmark's webhooks. It lists changes to the code that no test notices. Start with the node project; whether it supports Vitest's browser mode is unknown.

## Hits

None yet.
