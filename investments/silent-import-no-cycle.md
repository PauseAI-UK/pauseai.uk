# eslint-plugin-import's rules check nothing

Size: S. Kind: small fix.

## Problem

`eslint-config-next` turns on eslint-plugin-import's rules (`import/no-anonymous-default-export` among them), but in this repo they silently report nothing. The plugin can't load `@typescript-eslint/parser`, which npm nests inside `eslint-config-next/node_modules`, so it parses no TypeScript file and every rule passes. `import/no-cycle` (https://github.com/import-js/eslint-plugin-import/blob/main/docs/rules/no-cycle.md) reported nothing even for a planted cycle of two files. Pointing `import/parsers` at the nested parser's absolute path didn't make it parse either.

So the check against import cycles is a test of its own, `tests/checks/import-cycles.test.ts`, on the import map the storyboard uses (`scripts/storyboard-reach.mjs`).

## Fix

Either make eslint-plugin-import able to parse TypeScript here (a parser it can resolve, perhaps `@typescript-eslint/parser` as a direct dependency), and check that a planted fault fails each rule; or remove its rule-set from the ESLint config, so no one takes a rule that can't fail for one that passes.

## Hits

- 2026-11-14: `import/no-cycle` reported nothing for a planted two-file cycle, so the cycle check had to be written as a test instead
