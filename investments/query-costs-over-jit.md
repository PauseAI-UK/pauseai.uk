# Queries priced over JIT's threshold, caught before CI

Size: S. Kind: tools.

## Problem

CI's Postgres compiles any query the planner prices over 100,000 before running it, which can take seconds, so a test that runs one can time out in CI and pass here in milliseconds (docs/code-structure.md, "How fast a query has to be"). `npm run query-costs` lists such queries the node tests run (`scripts/README.md`, "Coverage"), but only when someone runs it, and it doesn't see the queries the storyboard's pages run, though those run on fresh databases too.

## Fix

1. Run `npm run query-costs` in CI, or as a lane of the gate, failing on any query over the threshold. It takes about as long as the node tests. CI's part is a change to `.github/workflows/`, which a maintainer pushes (`ci-workflow-pushes.md`).
2. Give the storyboard's fixture server the same `PGOPTIONS`, and list what its flows ran over the threshold.

## Hits

None yet.
