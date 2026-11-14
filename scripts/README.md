# Scripts

What each script here does. Run them from the repo root, through `npm run`
where there's an npm script. Each file's opening comment has the details.

## Database

| Script               | Run with                                                     | What it does                                                                                                                                                                                 |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `db-reset.mjs`       | `npm run db:reset`                                           | Wipes and remakes the local database `NETLIFY_DB_URL` names, with every migration, the test MPs (`TEST_MP_EMAIL`) and fake data (`DATA_FIXTURES=1`). Refuses a database on another machine.  |
| `db-migrate.mjs`     | `npm run db:migrate`                                         | Applies the migrations the local database hasn't had yet. `--applied-up-to 0011` is for a database made before the `schema_migrations` table. Local only: Netlify applies migrations itself. |
| `db-schema.mjs`      | `npm run db:schema`                                          | Rewrites `netlify/database/schema.sql` by applying every migration to a throwaway database and dumping it with `pg_dump` 18. Run it with each new migration.                                 |
| `fresh-database.mjs` | `node scripts/fresh-database.mjs <name> [--test-mp <email>]` | Makes an empty database with the migrations applied and prints its URL. The other database scripts, the tests (`tests/database.ts`) and the Playwright builds use its functions.             |

`docs/development.md`, section 3, covers using them.

Two more scripts check the migrations:

- `migrations-unchanged.mjs`, run by CI and the pre-push hook, fails if a migration already pushed has changed. It compares with what its arguments name: `--main` for where the branch left origin/main, `--pushed` for the branch on origin, or a commit.
- `migration-order.mjs`, run by CI, the gate and the pre-push hook, fails if a migration on disk that origin/main doesn't have isn't numbered after main's last, or if two share a number. It says the next free number. With `--open-prs` it also warns of an open pull request with one of the same numbers.

## Storyboard

| Script                   | Run with                                      | What it does                                                                                                                                                                                                                                                 |
| ------------------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `storyboard.mjs`         | `npm run storyboard`                          | The storyboard review, and the gate's storyboard: runs the flows a change can reach, with screenshots on both viewports, carries the rest, takes main's frames from the store (running main's own suite for any not there), and opens the page pairing them. |
| `storyboard-changed.mjs` | `npm run storyboard:changed`                  | Prints the frames of the latest run (or one named) that differ from main, are new or are gone, with each one's caption and the paths of its pictures. `npm run storyboard -- --changed` prints them after a run.                                             |
| `copy.mjs`               | `npm run copy`                                | Writes `test-results/copy.html`: each placeholder the branch adds or changes, with its file and line and the latest run's frames that picture it, the copy in a box, and those no frame pictures. `-- --storyboard` runs the storyboard first.               |
| `storyboard-store.mjs`   | imported by `storyboard.mjs`                  | Keeps each review's frames under the tree it pictured, in the main checkout's `test-results/storyboard-frames/`, for every worktree: main's frames come from there, a review can start from them, and main runs only for the flows it hasn't got.            |
| `storyboard-reach.mjs`   | imported by `storyboard.mjs`                  | Works out which flows a change can reach, from what each flow opened and what those pages import, and so which a review runs.                                                                                                                                |
| `reach.mjs`              | `npm run reach`                               | Lists the site's files that reach the most storyboard flows, from what the kept flows opened, so the imports to narrow first are at the top. `-- 100` lists more; `-- lib/email` only those under a folder.                                                  |
| `storyboard-main.mjs`    | imported by `storyboard.mjs`                  | Works out which flows the suite has, which a partial run carries from the last, and which took pictures.                                                                                                                                                     |
| `main-checkout.mjs`      | imported by `storyboard.mjs`                  | Main's checkout, a git worktree in your temp folder: checks out where this branch left origin/main there, with its own dependencies, and lets one process use it at a time.                                                                                  |
| `serve-fixture.mjs`      | Playwright's `webServer`, or by hand          | Builds this checkout on fixture data, with a fresh database of its own, and serves it on the checkout's own port (`tests/checkout.mjs`). Start it yourself to keep one server up between runs (`docs/development.md`, "Tests").                              |
| `record-requests.mjs`    | loaded into the server by `serve-fixture.mjs` | Keeps the address of every request the fixture build's server gets from each flow, for the flow to record as what it opened.                                                                                                                                 |
| `serve-main.mjs`         | started by `storyboard.mjs`                   | Builds and serves where this branch left origin/main (or `--ref`) on fixture data, from main's checkout, on this checkout's port for main: for `--this-suite-on-main`, which runs this branch's suite against it.                                            |

`docs/testing.md`, "The storyboard", covers them.

## Content and data

| Script                           | Run with                                          | What it does                                                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `generate-ai-sentiment-data.mjs` | `npm run data:ai-sentiment`                       | Turns the AI Sentiment 2026 CSVs in `data/` into the JSON beside them, which `/global-ai-sentiment-2026` shows. Run it after editing a CSV.                                                               |
| `detect-face-positions.mjs`      | `npm run data:story-image-detect-faces -- <file>` | Finds the face in a photo in `public/images/people/` and sets that person's `imageStyle` in `lib/content/people.ts`. `--dry-run` only prints it. Always name the file: without one, it resets everyone's. |
| `march-preview.mjs`              | `npm run march:preview`                           | Remakes the march page's link preview, a picture of its hero, from the dev server. Run it after changing the march's date, time or route, or the hero.                                                    |

`docs/development.md`, section 5, covers the photos.

## The gate

`gate.mjs`, run with `npm run gate`, is the CI gate. It has two parts:

1. Prettier, the types, ESLint and Stylelint on the files changed since `origin/main`, and the migrations' order.
2. What CI runs, in parallel, with the storyboard as the review of the flows a change can reach.

Each command has a time limit and a log in `tmp/gate/`, and the gate ends with a table of exit codes. `--fast` stops after the first part, and `--no-storyboard` leaves out the storyboard. `docs/testing.md`, "`npm run gate`", covers it.

`placeholders.mjs`, run with `npm run placeholders`, fails while any file has placeholder copy, and lists each line that does. CI, the gate and `npm run build` run it (AGENTS.md, "Never write final copy").

## Worktrees

`worktree.mjs`, run with `npm run worktree -- <branch>`, fetches, adds `tmp/worktrees/<branch>` as a new branch from `origin/main`, runs `npm ci` in it and prints the ports its storyboard will serve on. It leaves the storyboard keeping main's frames in the background, for the branch's first review. With `--ports` it only prints this checkout's ports. `docs/development.md`, "Worktrees", covers it.

`serve.mjs`, run with `npm run serve -- [<branch> | <PR number>]`, serves a branch's worktree on fixture data with `next dev`, making the worktree if need be. In front of `next dev` it puts a proxy on this machine's network address, which strips `Secure` from cookies. It checks the link in Firefox, then prints it. `--stop` stops it. `docs/development.md`, "Serving a branch", covers it.

## Coverage

`test-changed.mjs`, run with `npm run test:changed`, runs the Vitest tests for the files changed since origin/main, committed or not, and lists each changed source file's uncovered lines, functions and branches, even while a test fails. Anything after `--` goes to Vitest. `npm test` is still the gate (`docs/testing.md`, "Coverage").

## Investments

`investments.mjs`, run with `npm run investments`, lists the items in `investments/`, most hits first, with each one's size and kind, and writes the same list to `investments/ranked.txt` (`investments/README.md`).

`friction-sweep.mjs`, run with `npm run friction-sweep`, reads Claude Code's session logs for this repo on your machine. They're in `~/.claude/projects/-pauseai-uk/`, the folder named after the main checkout's path. It writes to `tmp/friction-sweep.txt`, by week, the rebase conflicts in each file, and how many sessions:

- set `TEST_DATABASE_URL` by hand;
- ran the gate's checks by hand;
- set up a worktree by hand;
- killed a server on a port;
- read `storyboard.json` with a script;
- edited files with `sed -i` or inline Python;
- ran out of context;
- had the Bash-first experiment on.

The logs hold private data, so the script writes only counts and the paths of files in the repo. `--logs <folder>` reads another folder. The sweep is for the monthly review (`investments/README.md`).

## Tests and types

The `*.test.ts` files test the scripts beside them, in the Vitest node
project. The `.d.mts` files give the scripts' functions types, for the
TypeScript that imports them.
