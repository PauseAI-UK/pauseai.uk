# Trying a lint rule before adopting it

Size: S. Kind: tools.

## Problem

Before turning an ESLint rule on, you need to know how many lines it flags and what kind they are: a rule that flags two lines is fixed in passing, and one that flags forty unrelated ones is left out or needs a list of files still to change. Nothing does this. `npx eslint --rule` from the command line fails on a rule that needs the types, as it also lints the `.mjs` files, which have none. So the rule goes into `eslint.config.mjs` by hand, the whole repo is linted to a JSON file (about two minutes), and a throwaway script counts the hits by rule, split into site code and tests.

## Fix

`npm run lint:try -- <rule> [<rule>…]`: lints with the rules added to the typed block for that run only, and prints, for each, how many lines it flags in site code and in tests, then each line with its file. Options for a rule go in as JSON.

## Hits

- 2026-11-24: nine rules tried for the error handling work, by editing the config and counting with a script in `tmp/`, ~20 min
