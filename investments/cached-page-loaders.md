# Cached page loaders

Size: S. Kind: small fix.

## Problem

Several staff pages load their data twice per request, once in `generateMetadata` for the title and once in the page: `getPolitician` in `politicians/[id]/page.tsx`, `askPageData` in `asks/[slug]/page.tsx` (a page of answers, for a title), `supporterOf` in `supporters/[id]/page.tsx`, and the events page's `eventsPage` and `savedFiltersState`. Only `sessionOf` is wrapped in React's `cache()`.

## Fix

Wrap the per-request loaders in `cache()` (https://react.dev/reference/react/cache), or give titles their own small queries. `docs/code-structure.md` says a page's metadata reuses its loader.

## Hits

- 2026-10-27: staff buttons were reported to feel unresponsive
