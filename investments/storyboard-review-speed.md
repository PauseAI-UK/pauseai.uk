# A quicker storyboard review

Size: M. Kind: tools.

## Problem

A review pictures the flows that the files a branch changes from main can reach, and runs main for the same flows (`docs/testing.md`, "Which flows a review runs"). CI on a pull request runs the same choice without pictures. Every flow on both viewports takes about five minutes on seven workers, and the suite grows with every feature. What still makes a review long:

- **Some files reach most flows.** Over the 20 PRs merged before 24 November 2026 a review would picture 47% of the desktop flows on average: none for five, most for a feature PR, which touches the staff areas' copy, the email layer and the fixture fakes. Each of those reaches 200 to 300 of the 354 desktop flows through real imports, so splitting one moves the average by a point or two. `npm run reach` lists the files that reach most.
- **The gallery's flows are a quarter of a full review.** A component whose examples are in its group's own file (most of the site's kit, `_examples/ui.tsx`) is pictured whenever its group is reached.
- **A checkout with no kept runs pictures every flow.** Which pages a flow opens is known only from a run of it, kept on the machine that ran it. A new sandbox has none, so it runs every flow, and main runs for every flow too.
- **A flow's record of its pages can be wrong.** One from an older main is out of date if a merge since changed which pages the flow opens, and the review then leaves the flow out. Six flows record different pages from one run to the next, for reasons not known: a press logo in `onboarding-embed`, `/staff` in "Folding the sidebar", `/what-is-pauseai-uk` in "Closing a submenu", and three addresses in two phone flows of `mailings` and `politicians`.

## Fix

In order of what each would save:

1. **A checkout with no kept run reads main's record from CI.** Main's CI already records what each flow opened (`storyboard-opened.json`, in the Actions cache). Uploaded as an artifact too, a review with no kept run could fetch the newest with `gh run download`, and choose its flows in seconds.
2. **CI pictures main** on each push to it and keeps the frames as an artifact, for a review to fetch. First compare one run of CI's with one made locally: fonts and the machine may make the pictures differ.
3. **Show the review as it fills:** open the page at once, and add this branch's side as it arrives.
4. **An audit of the map that can be run again**, after a change to how the site is built (a new Next, another bundler). On 12 November 2026 each desktop flow was run alone with the server's coverage taken, and every source file that ran was in what the map says the flow reaches; the scripts weren't kept.

## Hits

- 2026-11-12: three full reviews in a row on one branch, five minutes each with the build, as each turned up one failing phone flow and the fix to a shared piece (the bubble) needed every flow run again, ~20 min waiting
- 2026-11-16: the gate's storyboard in a new sandbox had no frames to carry, so it ran all 626 branch flows (7 min) and then main's whole suite, and stopped at its 20-minute limit before comparing; the gate failed for that alone, ~25 min waiting
- 2026-11-24: a change to `lib/server/problems.server.ts` and `db.server.ts`, which most flows reach, ran all 711 flows on both viewports in the gate, 19 min
