#!/usr/bin/env node
// Starts a branch in a worktree of its own, ready to work in:
//
//   npm run worktree -- <branch>   # tmp/worktrees/<branch>, a new branch from origin/main
//   npm run worktree -- --ports    # the ports this checkout's storyboard uses
//
// It fetches, adds the worktree under the main checkout's tmp/worktrees/
// (wherever it's run from), installs the dependencies with `npm ci`, and
// prints the ports the worktree's storyboard will serve on
// (tests/checkout.mjs), warning if another worktree has the same.
//
// The branch tracks nothing, so a plain `git push` can't push to main;
// push it with `git push -u origin <branch>`.
import { execFileSync } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkoutPorts, CHECKOUT_DIR } from "../tests/checkout.mjs";

/** Where the worktree for `branch` goes, under the main checkout at `root`. */
export function worktreePath(root, branch) {
  return join(root, "tmp", "worktrees", branch);
}

/** The worktrees `git worktree list --porcelain` lists, but for the review's copies of main (scripts/serve-main.mjs). */
export function worktreePaths(porcelain) {
  return porcelain
    .split("\n")
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length))
    .filter((path) => !/(^|\/)pauseai-storyboard-main-[0-9a-f]+$/.test(path));
}

/** The lines that say which ports a checkout's storyboard uses, and any other checkout that shares them. */
export function portLines(dir, others) {
  const { local, main } = checkoutPorts(dir);
  const lines = [
    `Its storyboard serves this branch on http://localhost:${local}, and main beside it on http://localhost:${main}.`,
  ];
  for (const other of others) {
    if (other !== dir && checkoutPorts(other).local === local)
      lines.push(`Warning: ${other} has the same ports, so one's storyboard refuses the other's server while it runs.`);
  }
  return lines;
}

const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

function main(args) {
  const others = () => worktreePaths(git(["worktree", "list", "--porcelain"]));
  if (args[0] === "--ports") {
    for (const line of portLines(CHECKOUT_DIR, others())) console.log(line);
    return;
  }
  const [branch] = args;
  if (!branch || branch.startsWith("-") || args.length > 1) {
    console.error("Usage: npm run worktree -- <branch>");
    process.exit(2);
  }
  git(["check-ref-format", "--branch", branch]);
  if (git(["branch", "--list", branch])) throw new Error(`There's a branch called ${branch} already.`);

  // The main checkout, which holds the repository: its tmp/ has every worktree.
  const root = dirname(git(["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  const dir = worktreePath(root, branch);
  if (existsSync(dir)) throw new Error(`${dir} exists already.`);

  execFileSync("git", ["fetch", "origin"], { stdio: "inherit" });
  execFileSync("git", ["worktree", "add", "--no-track", "-b", branch, dir, "origin/main"], { stdio: "inherit" });
  execFileSync("npm", ["ci", "--prefer-offline", "--no-audit", "--no-fund"], { cwd: dir, stdio: "inherit" });

  // As the scripts see them from inside: process.cwd() is the real path.
  const real = realpathSync(dir);
  const worktrees = others().map((path) => (existsSync(path) ? realpathSync(path) : path));
  const from = git(["log", "-1", "--format=%h %s", "origin/main"]);
  console.log(`\n${relative(root, dir)}: ${branch}, from ${from}`);
  for (const line of portLines(real, worktrees)) console.log(line);
  console.log(`cd ${real}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
