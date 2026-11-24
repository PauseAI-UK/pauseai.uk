# A flow's requests and uncaught errors, where they came from

Size: S. Kind: tools.

## Problem

When a flow fails on what its page logged, nothing says which request brought the error, or where in the browser's code it was thrown. A failed flow's Playwright trace (`trace: "retain-on-failure"`) has the test's steps but none of the page's requests or console, and a minified React error's own stack is one line. Finding the cause means adding a logger to `tests/storyboard/fixtures.ts` by hand: each fetch, an action's response body, and the throw site from Chrome DevTools Protocol's `Runtime.exceptionThrown`, which keeps the stack at the throw, async callers too.

## Fix

Let a run ask for it, such as with an environment variable: for each flow, a log in `test-results/` of the page's document and fetch requests (method, address, the `Next-Action` header), each action's response, the console, and each uncaught exception's stack from `Runtime.exceptionThrown` (with `Debugger.setAsyncCallStackDepth`). Or find why the trace leaves the page out, and fix that, if the trace can hold the same.

## Hits

- 2026-11-24: a flow failed on React error #441 in some runs; logged each request, action response and exception stack by hand in fixtures.ts to find the cause, ~1 hour
