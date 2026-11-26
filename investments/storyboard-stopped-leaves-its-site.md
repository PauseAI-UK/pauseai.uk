# A stopped review leaves its site running, and the next one waits on it

Size: S. Kind: tools.

## Problem

Stopping `npm run gate` or `npm run storyboard` partway, by killing it, leaves the review's fixture server (`scripts/serve-fixture.mjs` and its `next-server`) running on the checkout's port. It no longer answers, yet the next review in the checkout finds the port taken and waits on it: Playwright starts, runs no flow and prints nothing, with no time limit.

## Fix

Have the storyboard stop its fixture server when it's interrupted (SIGINT, SIGTERM), and, before starting, check that a server on its port answers within a few seconds, stopping it if not. Then have the storyboard say when no flow has finished for several minutes.

## Hits

- 2026-11-26: a gate stopped during its storyboard left the site running; the next review waited on it for nearly two hours unseen
