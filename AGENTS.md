# Agent notes

Read `README.md` first. It links the docs in `docs/`, including the code structure and styling rules (`docs/code-structure.md`), test policy (`docs/testing.md`) and the style guide (`docs/style-guide.md`). Plans for work in progress are in `plans/`. They're temporary, deleted when the work is done, so nothing references them (`plans/README.md`).

## Log friction in `investments/`

`investments/` holds the work that would make the code easier to change or the site safer to run: architecture refactors, operations, small fixes and missing tools, one file each. When one costs you time (a script in `tmp/` you'd want again, the same edit in many places, a flaky test, a long wait on a check, a bug the design made easy), add a dated line under its "Hits", or start a file for it. `investments/README.md` says how, and `npm run investments` lists the most hit. Nothing private goes in a hit, and nothing about how you used production services or the database.

## Comments describe the code as it is

A comment says what the code does and why, as it stands. It doesn't tell the code's history: not what it replaced, what changed or moved, what it used to do, or which plan or PR brought it. That belongs in the commit message. Write "Every field is the kit's", not "Fields now come from the kit instead of each form's own". The same goes for docs. The rest of the rules (no counts that go stale, explain once at the definition, what a test fixture's comment says) are in `docs/code-structure.md`, "Comments".

## Claude Code's settings

`.claude/settings.json` sets `CLAUDE_CODE_THRIFTY_SONIC=0`, which turns off an experiment in Claude Code's auto mode that tells agents to read with `cat` and edit with `sed` or scripts rather than the Read and Edit tools. Edit is safer: it needs the file read first and an exact match, and shows a diff. The variable isn't documented, so if a session's instructions still steer you to Bash, say so.

## Scratch files

Put throwaway scripts, logs and screenshots in `tmp/` at the repo root (to screenshot the site, see "Screenshots" below). It's gitignored, and scripts there can import the project's `node_modules` (e.g. `@playwright/test`, `sharp`). Long-running checks, such as probing the site in Chromium, Firefox and WebKit, can run in the background and write their output there.

## Worktrees

`npm run worktree -- <branch>` starts a new branch from `origin/main` in `tmp/worktrees/<branch>`, with its dependencies installed, and prints the ports its storyboard serves on (`docs/development.md`, "Worktrees"). Each checkout's storyboard has its own ports and databases, so worktrees can run it at once.

## Serving a branch

When Francis asks for a branch to be served, run `npm run serve -- <branch or PR number>` in the background. Once it says it's serving, give him the link it prints: by then it has checked the link in Firefox (`docs/development.md`, "Serving a branch"). Leave it running until he's done with it, then stop it with `--stop`.

## The CI gate

```bash
npm run gate                      # the fast checks on the files you changed, then everything CI runs
npm run gate -- --fast            # the fast checks alone: Prettier, ESLint and Stylelint on the changed files, the types, and the migrations' order
npm run gate -- --no-storyboard   # everything but the storyboard
```

The branch isn't done until `npm run gate` exits 0. It takes the files changed since the branch left `origin/main`, committed or not, formats them with Prettier and checks them, and stops there if a check fails. Then it runs what CI runs (`.github/workflows/ci.yml`) in parallel, as CI's jobs do:

- the types, then the storyboard: the review (below), of the flows your change can reach, so the gate's run counts as a review and a review's as the gate's;
- `npm test`, with the coverage gate;
- the four linters, then the placeholder check, one after another;
- the backup Worker's package.

Each command has a time limit and a log in `tmp/gate/`. While they run, a line a minute says which are still running and whose log has gone quiet. The gate ends with a table of exit codes and the end of each failed log. Go by those exit codes, not a grep of the output: `npm test` can report every test passing and still fail on coverage.

It takes a few minutes, so run it in the background with its output going to a file in `tmp/`, and look at that file each minute (`docs/testing.md`, "`npm run gate`").

It leaves out `npm run build`: that repeats the unit tests and linters, and the storyboard builds the site anyway. Two `next build`s in one checkout share `.next`, so never run two at once, and don't run the gate beside a storyboard review in the same checkout. CI runs every flow, without pictures, as `npm run test:storyboard` does.

If the prek Git hook is installed (`npm run hooks:install`), commits run Prettier, ESLint and Stylelint on the staged files first. Prettier rewrites them, so `git add` and commit again. That's only part of the gate.

Running one Vitest project (`npm run test:node`, `npm run test:browser`) or one file doesn't check coverage, so it isn't the gate. While writing tests, `npm run test:changed` runs just the tests for the files changed since origin/main and lists what in those files isn't covered (`docs/testing.md`, "Coverage"); it isn't the gate either. The tests that need a database make their own in Postgres (`docs/testing.md`).

## Pull request descriptions are short

A title, then a bullet or two per change: what it does and why, in plain words. Leave out what the diff or the commits already say: file lists, and how it was tested beyond "the CI gate passes". Anything left for later gets one line saying so, and no more.

## Migrations are fixed once pushed

Pushing a branch with an open PR makes a deploy preview, and Netlify applies its migrations to that preview's database, as it does to production's on deploy. It refuses a migration changed since it was applied, which fails the deploy. So once a migration has been pushed, it can't be edited, even if the branch hasn't merged.

So don't push a migration early. If the branch has a migration that may still change, or you think it may need another, settle the schema first and push once it's settled: the first push of the branch waits for that, however far along the rest of the work is. Every migration on a pushed branch is final.

`scripts/migrations-unchanged.mjs` checks this: CI's "Types, migrations" job fails if a migration on main or in the branch's last push has changed, and the prek pre-push hook (`npm run hooks:install`) stops the push before it gets that far.

Before changing a migration, `git fetch`, then check whether it's on the remote branch or main (`git log origin/<branch> origin/main -- netlify/database/migrations/<file>`, or `git show origin/<branch>:<path>` to see the version pushed):

- If it's there, add a new migration, numbered after the last, and leave the pushed file exactly as it was.
- If it's only local, edit it.

Either way, run `npm run db:schema` and commit `schema.sql` with the migration (`docs/development.md`, "Adding a migration").

A new migration must be numbered after main's last when the branch merges: Netlify refuses one out of order, failing the deploy. A PR's migrations are consecutive numbers. Its first comes after main's and every open PR's. Each one after follows its own last, even if another open PR has taken that number since: never skip over another PR's number, as that interleaves the two PRs' migrations, and whichever merged second would fail. When two open PRs clash, or main catches up with a PR's migrations, they're renumbered to follow main's last (for a clash, the PR that merges second). If they've been pushed, that takes a new branch and a new PR: a pushed migration can't be renamed, and the old PR is closed. `scripts/migration-order.mjs` checks the order in CI's "Types, migrations" job, the gate and the pre-push hook, warns of a clash, and says the number to take next, as `npm run worktree` does.

A PR with a migration carries the `migration` label, so the open PRs whose merge order matters can be seen at a glance: `gh pr create --label migration`, or `gh pr edit <number> --add-label migration` when a migration joins a PR that's already open.

## The storyboard

`tests/storyboard/` is one Playwright suite that drives every flow on fixture data (`docs/testing.md`, "The storyboard"). A spec file is a section, a test is a flow, and each `await frame(page, "caption")` is a frame. A frame is a caption and, in the review, a screenshot: of the whole page when it's at the top, or of the window once it's scrolled or while a menu or dialog is open. A spec file declares its section's name and place on the review page (`export const section: Section = …`, after its imports). `docs/testing.md`, "What the storyboard covers", lists what each section drives; a new spec file or route handler needs a line there.

- Every new interactive behaviour goes in a flow, existing or new, with a frame after each thing a person would see. A PR without it isn't done.
- A flow is told in words anyone who has used the site would follow: its title just names it ("The letter bounces"), each caption says what its frame shows ("The email staff get"), and `story("…")` lines, at the start and between the frames, say what happens and why (`docs/testing.md`, "How a flow is told").
- Flows stay small: one thing a person does, about ten frames at most. Every flow stands alone: its own database (the `flowDatabase` fixture), a fixed clock, unique identifiers.
- Before saying a change is done, run the review and look at every changed frame on both viewports. It never fails on a difference, so it proves nothing until you've looked. Say in the commit or PR what changed. Finish on a review run after your last change, so the latest run is one a person can open and check too, and say which run it is.
- `npm run storyboard` runs only the flows that the files changed since each flow's last run can reach, and those new or failed, and carries the rest, from the latest run or from frames another checkout kept; with nothing to run, it runs nothing (`docs/testing.md`, "Which flows a review runs"). A migration, the seed data or `package.json` reruns every desktop flow. Main's frames are carried the same way, so a rebase or a new commit of main runs main only for what changed. `--plan` says what a review would run, and why.
- If a review says it ran every flow because it couldn't place a file, teach `scripts/storyboard-reach.mjs` what that kind of file reaches, or log a hit on `investments/storyboard-review-speed.md` naming it. If it says a server was already up, stop that server: its flows aren't recorded as this code's, so the next review runs them all again.
- A flaky flow, or a frame that differs between two runs of the same build, is fixed, never retried, skipped or masked. No stored baselines, no gate on pixels.
- Any flaky test, Vitest or Playwright, is fixed at once, in whatever branch finds it, even when the branch has nothing to do with it (`docs/testing.md`, "Rules for new code").

```bash
npm run storyboard                # the flows a change can reach, both viewports, screenshots, against main's frames (where this branch left origin/main), then opens the run's page (test-results/storyboard/index.html leads to the newest)
npm run storyboard -- --no-open   # the same, leaving the page closed
npm run storyboard -- --plan      # which flows a review would run, and why, running none
npm run storyboard:changed        # the latest run's changed frames: new, gone or different from main's, with each one's caption and PNGs; then every frame of each flow main is missing (new here, or failed on main)
```

To review a run, list its changed frames with `npm run storyboard:changed` (or add `--changed` to the run) and open each one's PNGs with the Read tool, those of the flows main is missing too, rather than reading `storyboard.json` with a script of your own.

## Screenshots

To see a page or a step of a flow, use the storyboard, not a script of your own. It builds the site on fixture data and waits for each page to settle, and any flow can get you logged in, partway through a form or past a bounce. Pick a section (spec file) and a flow (`-g`, a regex on the test's title; `public-pages` titles each test with its route):

```bash
npm run storyboard -- --no-main --no-open --paths public-pages -g '/donate$'   # one page, both viewports
npm run storyboard -- --no-main --no-open --paths --phone campaigns -g ZZ99ZZ   # a flow, every frame
```

- `--no-main` leaves main out: the branch's frames alone. Drop it to see main beside the branch.
- `--desktop` or `--phone` picks one viewport.
- `--paths` prints each frame's caption and PNG path, to open with the Read tool.

Each run gets its own folder, so the review someone has open is never changed. A narrow run carries the rest of the latest review rather than clearing it.

Main's frames are main's own: its suite, run on its build. They're kept by main's tree for every worktree, so main runs once for each commit of main, only for the flows its change can reach, and `npm run worktree` starts that in the background (`docs/testing.md`, "Main's frames are main's own"). So a frame that differs shows everything the branch changes, a flow's steps as well as the site, and a flow or caption the branch renames shows as one gone and one new.

The fixture server's port comes from the checkout's path, and the storyboard refuses a server built from another checkout. But it reuses this checkout's server however old its build is, so stop one left from before your last change.

If no flow reaches what you need, add a `frame()` to one, or add a flow (see above), rather than writing a script in `tmp/`.

To see a component, use the component gallery (`/gallery`, fixture builds only; `docs/testing.md`, "The component gallery"). Every component has an example there, a page per group, and the gallery section has a flow per group, with a frame of each component:

```bash
npm run storyboard -- --no-main --no-open --paths gallery -g 'gallery: ui$'   # the UI kit, both viewports
```

A new component gets its example in `app/(tools)/gallery/_examples/` (`tests/checks/gallery.test.ts` fails otherwise); look at it there before saying it's done. Check the gallery before writing a component or CSS, too: what you need may exist, or need only a variant (`docs/style-guide.md`).

## Every change needs 100% test coverage

**Every file must stay at 100% coverage: branches, statements, functions and lines.** Branches matter most: every `? :`, `??`, `||`, `&&` and `if` needs a test for each way it can go. A test for the obvious path isn't enough. CI fails otherwise (`thresholds: { 100: true, perFile: true }` in `vitest.config.mts`), and coverage-ignore comments are banned.

Before you say a change is done, run `npm test`. That's both Vitest projects with the coverage gate, as CI runs it. A plain `vitest run` doesn't check coverage, so it can pass while CI fails. Write the tests along with the code, not afterwards. See `docs/testing.md`, "Coverage".

## Never write final copy

People write the words visitors and recipients read: page text, letters, emails, form labels and messages. When code needs copy that doesn't exist yet, write a placeholder: a draft in plain English that starts with ⁂, e.g. "⁂ Import the calendar now", so a person can see what the words must say and it can't be mistaken for the real thing.

`npm run placeholders` fails while ⁂ appears anywhere in the repo outside this file, and names each line. CI, the gate and Netlify's build run it, so placeholders can't be merged by accident. It isn't one of the tests, so while a branch's copy waits, `npm test` still checks its coverage: only the placeholder check's own row of the gate's table fails.

After every storyboard review of a branch with placeholders, run `npm run copy` and give the person you're working with the page it writes, so they can see the copy waiting for approval: it writes one page, `test-results/copy.html`, with each placeholder the branch adds or changes, its file and line, and the frames that picture it (`docs/testing.md`, "The copy to approve").

## The repo is public

Anyone can read this repo and its history, so nothing private goes in it: not in code, tests, fixtures, docs, plans or commit messages. That means no supporter's, volunteer's or constituent's name, email, phone number, postcode or address, no text of their letters or emails, and no secrets or tokens. When an example needs a person, make one up (Jane Smith, jane.smith@example.com). Real data you look at while working, from the database, Gmail, Postmark or Airtable, stays in `tmp/`, which is gitignored, or the scratchpad. Public figures in their public role, such as an MP and their office address, are fine.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
