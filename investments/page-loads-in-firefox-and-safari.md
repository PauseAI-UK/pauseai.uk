# A page's load is only ever watched in Chromium

Size: M. Kind: tools.

## Problem

Every check of how a page loads runs in Chromium: the component tests, the storyboard at both sizes, and `npm run measure`, whose slow connection is Chromium's own. Firefox and Safari differ in what they fetch and when, and nothing here would notice.

Two differences found by hand on the home page:

- Safari's engine fetches a preloaded image a second time for an `<img loading="lazy">`. Six of the hero's photos were downloaded twice on a wide window, and one on a phone.
- Firefox asks again for a preloaded font it was told not to keep, a round trip on a slow connection.

Finding them took a scratch setup: the build behind a proxy that slows every connection and logs each request, the stand-in for other sites reached through a second proxy (neither browser can be pointed at it by a flag, as Chromium can), and a script that loads the page in each engine and compares what was asked for with what the markup wants.

## Fix

Give `npm run measure` an `--engine` option. Its stand-in and its page-watching script work in any engine already. What's Chromium's alone is the slow connection and the film, so both would come from a proxy and from screenshots instead, for every engine alike. Its report would then list, per engine, any file fetched twice and any image fetched before its turn.

## Hits

- 2026-11-19: wrote the proxy, the per-engine loader and its summary in tmp/ to check the home page's loading in Firefox and WebKit, ~2 hours
