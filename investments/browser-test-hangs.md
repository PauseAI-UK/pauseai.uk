# A browser test that hangs says which

Size: S. Kind: tools.

## Problem

A component that renders in an endless loop freezes the page a Vitest browser test runs in, so the test's own time limit never fires. The run prints nothing more, and nothing names the file. `npm test` then sits until whatever limit it was started with, and a second run started beside it hangs the same way. A gallery example is an easy place to write one: `Logged`'s `log("name")` (`app/(tools)/gallery/_components/wiring.tsx`) is a new function each render, so passed to a prop an effect depends on, the effect runs again after every log.

## Fix

- Give the browser project a limit on a whole test file, enforced from outside the page, that fails the run naming the file.
- Have `Logged` hand out the same function for the same name each render, so an example can pass it to any prop.

## Hits

- 2026-11-11: a gallery example passed `log("report")` to a prop an effect called; two runs of `npm test` hung with no output until the files were run one at a time, ~15 min
