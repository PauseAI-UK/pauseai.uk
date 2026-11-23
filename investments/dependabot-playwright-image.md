# Dependabot's Playwright bumps leave CI's image behind

Size: S. Kind: small fix.

## Problem

CI's Test and Storyboard jobs run in Playwright's image (`container.image` in `.github/workflows/ci.yml`), whose tag must be `@playwright/test`'s version. Dependabot bumps the package but not the image: none of its ecosystems reads a workflow's `container.image`. So every weekly PR with a Playwright bump fails every Test and Storyboard shard on a missing browser until someone edits the tag by hand. `tests/checks/playwright-image.test.ts` names the cause, but among hundreds of launch errors.

## Fix

Take the tag from the lockfile rather than writing it twice: a small first job reads `@playwright/test`'s version from `package-lock.json` and outputs it, and the two jobs' `container.image` reads `needs.<job>.outputs.<version>`. Then `tests/checks/playwright-image.test.ts` can go.

## Hits

- 2026-11-23: the weekly PR's bump to 1.65.1 failed every Test and Storyboard shard; a CI round and a commit by hand
