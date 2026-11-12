# A fixture server that says which code it built

Size: S. Kind: tools.

## Problem

The storyboard reuses a fixture server that's already up on the checkout's port (`reuseExistingServer`, `playwright.config.ts`). It checks that the server was built from this checkout, but can't tell a build made before the last edit from one made after it. Two things follow:

- A review against a server left running may picture older code. It says a server was already up, and records none of its flows as this code's, so the next review runs them all again (`docs/testing.md`, "Which flows a review runs"). Until someone stops the server, every review repeats that work.
- Some flows can't run twice on one server. The fakes keep a flow's mail by its database's name, which is the same on every run, so the second run of a letter flow doesn't find its email in the outbox. Nine flows of `campaigns`, `letters` and `replies` fail that way on a server that has already run them.

## Fix

1. The build names the tree it was built from, as it names its checkout (the `X-Fixture-Checkout` header, `next.config.ts`). The storyboard reuses a server whose tree is the checkout's as it is now, and records its flows as that code's. One built from another tree it stops and builds again, or refuses, saying why.
2. The fakes forget a flow's mail when its database is made afresh, so a flow runs the same on a server that has run it before.

## Hits

- 2026-11-12: nine letter flows failed on a server that had already run them once, and the cause took about 40 minutes to find
- 2026-11-12: a review against a server left up ran flows whose records the next review couldn't use
