# A quicker storyboard review

Size: M. Kind: tools.

## Problem

A review's time is its flows': the fixture build takes 8 to 20 seconds, and every flow on both viewports takes about five minutes on seven workers. The suite grows with every feature: 348 flows on 31 October 2026, 578 on 11 November. Pictures and the settling before them are most of a flow's time.

A review runs only the flows a change can reach (`docs/testing.md`, "Which flows a review runs"). On the 79 later pushes of 37 PRs (12 November 2026), that was about half of a full review's time on average. A quarter of pushes need none. A sixth change a migration, `schema.sql` or the seed data, which reruns every desktop flow. What's left is mostly:

- **The staff pages reach most of the staff code.** A list page reaches 180 to 280 files, mostly through Server Action modules (`narrow-imports.md`), and `staffCopy` is in two thirds of the commits that rerun over half (`copy-beside-features.md`).
- **The gallery's flows are a quarter of a review.** A gallery flow is a whole group, one frame per component, and the six staff groups share `_examples/staff.client.tsx` (`gallery-beside-components.md`). So a change to one staff component re-pictures every staff group, about 45 seconds of a review.
- **One file of seed data**, which every desktop flow reruns for (`test-data-builders.md`).

Main's frames are kept only on the machine that ran them.

## Fix

In order of what each would save:

1. Picture only the gallery's sections whose example reaches a changed file: each section's heading names its example file, and a gallery frame doesn't depend on the ones before it, so it can be carried on its own. A change to one component is then a page load and a picture or two.
2. Have CI picture main on each push to it and keep the frames as an artifact, for a review to fetch. First compare one run of CI's with one made locally: fonts and the machine may make the pictures differ.
3. Show the review as it fills: open the page at once, and add main's side as it arrives.
4. An audit of the map that can be run again, after a change to how the site is built (a new Next, another bundler): the check below was made with scripts that weren't kept.

## How the map was checked

On 12 November 2026, against what runs. Each of the 280 desktop flows was run alone, on a warm server, with the server's precise coverage taken before and after it, and Next's prefetches answered with nothing. Every position of the build's source maps inside a function that ran was taken as its source file having run in that flow: 19,221 pairs of a flow and a file. Each file was in what the map says the flow reaches, from what the flow recorded as opened in that same run. Taking the hand-overs to `lib/server/problems.ts` back out of the map made the check fail on the two files they stand for, so it could have failed.

What that check found on the way, each now in the map or the recording:

- a flow's own request follows redirects without the browser's events, so the fixture server keeps every request;
- two flows start a second browser, whose requests weren't recorded;
- `run-store.ts` and `instrumentation.ts` hand code to `problems.ts` without an import;
- `next.config.ts` and `proxy.ts` import files no page does;
- files read by name or by listing a folder: fonts, a stand-in picture, the sitemap's walk of `app/`.

Then, by its pictures:

- A review with Next's prefetches answered with nothing pictured all 2,182 frames as one without did, so a page that's prefetched and never opened changes nothing a flow shows.
- Five planted changes, to a staff table, two stylesheets, a staff page's heading and the staff copy, reviewed from the store's frames: 486 flows ran and 80 were carried, and every frame was as a run of all 566 pictured it.
- With the map blinded to the staff copy on purpose and a label on every staff page changed, the review reached no flow, three of its six spot checks looked different, and it ran every flow.

The comparisons found one frame that differed between runs of the same code, the march's sticky header on the phone, now fixed (`tests/storyboard/frame.ts`, `repaintSticky`).

Following the flows' runs by coverage to choose them, in place of imports, picked a little fewer (45% of the time against 47%), but needs a run of one flow at a time. Not worth it.

## Hits

- 2026-11-12: three full reviews in a row on one branch, five minutes each with the build, as each turned up one failing phone flow and the fix to a shared piece (the bubble) needed every flow run again; the changes after the first touched four files, ~20 min waiting
- 2026-11-12: a full review took 12 minutes, not 5, with the machine busy with other work, and the staff kit's gallery flow (51 frames) passed its 60 seconds; the review after a one-line fix to a flow's step had to run whole again, ~25 min waiting
- 2026-11-14: a moved file's path in a comment of the seed data (tests/fixtures/staff-data.sql) reruns every desktop flow, though no SQL changed; a comment-only change to a .sql fixture could reach nothing
