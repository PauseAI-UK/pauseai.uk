# An expectation inside a stand-in action fails nothing

Size: S. Kind: small fix.

## Problem

`useFormResult` and `useSave` catch whatever an action throws, so the form can say it failed (`components/ui/`). In a component's test, the action is a stand-in, and an `expect()` written inside it throws into that same catch: the form shows "That didn't work", the browser's report of it goes nowhere, and the test carries on. It passes unless something later happens to notice.

## Fix

In the browser tests' setup (`tests/vitest.setup.browser.tsx`), make the default `reportBrowserError` fail the test it's called in, as an uncaught error would. A test of a failure hands the hook its own `report`, as `useSave`'s tests do.

## Hits

- 2026-11-24: expectations inside stand-in actions in two components' tests had to be moved to after the call, once their forms went through `useFormResult`
