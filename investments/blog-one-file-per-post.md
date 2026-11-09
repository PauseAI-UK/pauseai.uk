# A file per blog post

Size: S. Kind: small fix.

## Problem

Every blog post is in `lib/content/blog.tsx`, 2,314 lines for about 16 posts. TypeScript and JSX suit the content (real components, type checks, one editor), but one file makes each post hard to find.

## Fix

`lib/content/blog/<slug>.tsx` per post and an index, and the same for briefings as weeks accumulate.

## Hits

None yet.
