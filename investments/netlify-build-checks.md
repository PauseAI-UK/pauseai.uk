# Netlify's build without the checks

Size: S. Kind: tools.

## Problem

`npm run build`, which Netlify runs on every deploy, runs the typecheck, the node tests and both linters before `next build`. CI has already run and required them before a PR can merge. It costs build minutes, and it's why `describeWithDatabase` skips its tests on Netlify.

## Fix

Netlify's build runs the placeholder check and `next build` only, and the tests' skip on Netlify goes.

## Hits

None yet.
