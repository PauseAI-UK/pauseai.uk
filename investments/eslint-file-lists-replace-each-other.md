# A list of files can't be given its own rule in `eslint.config.mjs`

Size: M. Kind: small fixes.

## Problem

The site's own code gets `no-restricted-syntax` and `no-restricted-imports` from `siteCodeRules()`, a block for each set of files, and where two blocks cover one file the later replaces the earlier. So a rule for a list of files drawn from several blocks, such as "these forty may still import the old helper, nothing else may", can't be added as one more block: it would drop what each of those files' own block allows (a service's own API, `outsideFetch`, sending email). The choice is to give every block a twin for the listed files, or to write the rule as a check in `tests/checks/`, which doesn't run in the editor or the commit hook.

## Fix

Work out each file's allowances once, from every block that covers it, and build its rules from the result, so that a block adds to a file's allowances and never replaces them. Then a list of files still to convert is one more entry.

## Hits

- 2026-11-24: the list of files still reporting a problem by a sentence went into a check, not ESLint, for this reason, ~10 min
