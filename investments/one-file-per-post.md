# A file per blog post and briefing

Size: S. Kind: small fix.

## Problem

Every blog post is in `lib/content/blog.tsx`, 2,314 lines for about 16 posts, and every weekly briefing in `lib/content/briefings.tsx`, a new one each week. TypeScript and JSX suit the content (real components, type checks, one editor), but one file makes each post hard to find, and two weeks' briefings written at once edit the same file.

## Fix

`lib/content/blog/<slug>.tsx` per post and `lib/content/briefings/<slug>.tsx` per briefing, each folder with an index that lists them, so a new post or briefing is a new file and a line in its index.

## Hits

None yet.
