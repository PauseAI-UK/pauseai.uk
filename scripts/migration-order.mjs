#!/usr/bin/env node
// Fails if a migration this checkout adds wouldn't come after main's: Netlify
// applies migrations in order, and refuses one numbered at or below the
// highest it has applied ("added out of order"), which fails the deploy
// (https://docs.netlify.com/build/data-and-storage/netlify-database/troubleshooting/).
// It compares the migrations on disk with origin/main's, so in CI, whose
// pull request checkout is the branch merged into main, it catches a number
// main has taken since the branch began.
//
//   node scripts/migration-order.mjs              check, and say the next free number
//   node scripts/migration-order.mjs --open-prs   and warn of an open pull request with the same number
//
// CI's "Types, migrations" job, the gate and the pre-push hook run it. The
// open pull requests come from GitHub (`gh`): a warning, not a failure, as
// whichever merges second must be renumbered, and a pushed migration can't be.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const MIGRATIONS = "netlify/database/migrations";
const NAME = /^(\d+)_[a-z0-9_-]+\.sql$/;

/** A migration file's number, or undefined for a file that isn't one. */
export function numberOf(name) {
  const match = NAME.exec(name);
  return match ? Number(match[1]) : undefined;
}

/** A number as a migration's prefix, zero-padded to `width`. */
export function prefix(number, width = 4) {
  return String(number).padStart(width, "0");
}

/** The highest number among `names`, or 0. */
export function highest(names) {
  return Math.max(0, ...names.map(numberOf).filter((n) => n !== undefined));
}

/**
 * What's wrong with the migrations `own` adds to `main`'s (file names): one
 * not numbered above main's highest, or two with the same number.
 */
export function orderProblems(main, own) {
  const top = highest(main);
  const last = main.find((name) => numberOf(name) === top);
  const added = own.filter((name) => numberOf(name) !== undefined && !main.includes(name));
  const problems = added
    .filter((name) => numberOf(name) <= top)
    .map((name) => `${name} isn't numbered after main's last, ${last}: Netlify would refuse it as out of order.`);
  const seen = new Map();
  for (const name of added) {
    const other = seen.get(numberOf(name));
    if (other) problems.push(`${other} and ${name} have the same number.`);
    seen.set(numberOf(name), name);
  }
  return problems;
}

/**
 * The open pull requests, other than `branch`, that add a migration with a
 * number one of `added` has: `prs` as `gh pr list --json number,headRefName,files` gives them.
 */
export function openPrClashes(added, prs, branch) {
  const ours = new Map(added.map((name) => [numberOf(name), name]));
  return prs
    .filter((pr) => pr.headRefName !== branch)
    .flatMap((pr) =>
      pr.files
        .map((file) => file.path)
        .filter((path) => path.startsWith(`${MIGRATIONS}/`))
        .map((path) => path.slice(MIGRATIONS.length + 1))
        .filter((name) => ours.has(numberOf(name)))
        .map(
          (name) => `#${pr.number} (${pr.headRefName}) adds ${name}, the same number as ${ours.get(numberOf(name))}.`,
        ),
    );
}

/**
 * The number this checkout's next migration takes. A branch's migrations
 * are consecutive: once it adds one, the next follows its own last, never
 * skipping a number another open pull request has taken, which would
 * interleave the two so that whichever merged second would fail. Its first
 * comes after main's and every open pull request's.
 */
export function nextFree(main, own, prs = []) {
  if (own.some((name) => !main.includes(name))) return prefix(highest([...main, ...own]) + 1);
  const theirs = prs.flatMap((pr) =>
    pr.files
      .map((file) => file.path)
      .filter((path) => path.startsWith(`${MIGRATIONS}/`))
      .map((path) => path.slice(MIGRATIONS.length + 1)),
  );
  return prefix(highest([...main, ...own, ...theirs]) + 1);
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

/** The migration files at `ref`. */
export function migrationsAt(ref, cwd = process.cwd()) {
  return git(["ls-tree", "--name-only", `${ref}:${MIGRATIONS}`], cwd)
    .split("\n")
    .filter(Boolean);
}

/** The migration files on disk, committed or not. */
export function migrationsOnDisk(cwd = process.cwd()) {
  const dir = join(cwd, MIGRATIONS);
  return existsSync(dir) ? readdirSync(dir).filter((name) => numberOf(name) !== undefined) : [];
}

/** The most files `gh pr list` gives a pull request: a list that long may be cut short. */
export const LISTED_FILES = 100;

/**
 * The open pull requests and their files, from GitHub, or undefined if `gh`
 * can't say. `gh pr list` gives a pull request's first files only, in path
 * order, which can leave out netlify/'s, so one at that limit has all its
 * files read from the REST API (`run` stands in for gh in tests).
 */
export function openPrs(cwd = process.cwd(), run = gh) {
  try {
    const prs = JSON.parse(
      run(["pr", "list", "--state", "open", "--limit", "100", "--json", "number,headRefName,files"], cwd),
    );
    return prs.map((pr) =>
      pr.files.length < LISTED_FILES
        ? pr
        : {
            ...pr,
            files: run(
              ["api", "--paginate", `repos/{owner}/{repo}/pulls/${pr.number}/files`, "--jq", ".[].filename"],
              cwd,
            )
              .split("\n")
              .filter(Boolean)
              .map((path) => ({ path })),
          },
    );
  } catch {
    return undefined;
  }
}

function gh(args, cwd) {
  return execFileSync("gh", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
}

/**
 * Checks this checkout's migrations against origin/main's, and with
 * `prs`, against the open pull requests'. Returns the lines to print and
 * whether nothing would fail the deploy.
 */
export function check({ cwd = process.cwd(), prs } = {}) {
  const main = migrationsAt("origin/main", cwd);
  const own = migrationsOnDisk(cwd);
  const added = own.filter((name) => !main.includes(name));
  const problems = orderProblems(main, own);
  const lines = problems.length
    ? [
        "Migrations out of order with main's:",
        ...problems.map((problem) => `  ${problem}`),
        `Number each after the last on main, from ${nextFree(main, own, prs ?? [])}. One that's been pushed can't be renamed: it needs a new branch and pull request (AGENTS.md, "Migrations are fixed once pushed").`,
      ]
    : [`Migrations: ${added.length ? `${added.join(", ")} after main's last` : "none added"}.`];
  if (prs === null)
    lines.push("Migrations: couldn't ask GitHub for the open pull requests' (gh), so didn't check them.");
  if (prs) {
    const clashes = openPrClashes(added, prs, git(["rev-parse", "--abbrev-ref", "HEAD"], cwd));
    if (clashes.length)
      lines.push("Warning: another open pull request has the same number:", ...clashes.map((c) => `  ${c}`));
  }
  lines.push(`Migrations: the next free number is ${nextFree(main, own, prs ?? [])}.`);
  return { lines, ok: problems.length === 0 };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const prs = process.argv.includes("--open-prs") ? (openPrs() ?? null) : undefined;
  const { lines, ok } = check({ prs });
  for (const line of lines) console.log(line);
  process.exit(ok ? 0 : 1);
}
