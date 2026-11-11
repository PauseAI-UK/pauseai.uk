# One checkout's Playwright install deletes another's browsers

Size: S. Kind: tools.

## Problem

Every checkout and container shares one Playwright browser cache, `~/.cache/ms-playwright`. `playwright install` removes any browser that no installation it knows of needs, and it knows an installation by its path. A checkout mounted at another path in another container isn't there to be found, so its browsers go. The next `npm test` in that checkout fails before any test runs: "Executable doesn't exist at …/chromium_headless_shell-…".

## Fix

Install with `PLAYWRIGHT_SKIP_BROWSER_GC=1`, which keeps what's already there. No script installs the browsers, so the variable goes in the command that `docs/development.md` and `docs/testing.md` give (`npx playwright install chromium`). Or give each checkout its own cache with `PLAYWRIGHT_BROWSERS_PATH`.

## Hits

- 2026-11-09: the browser tests stopped mid-session, after an install from a checkout on a newer Playwright; reinstalled by hand, ~10 min
