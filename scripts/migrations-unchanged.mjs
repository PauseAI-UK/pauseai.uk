#!/usr/bin/env node
// Fails if a migration that has been pushed is changed, renamed or deleted:
// Netlify refuses a migration changed since it was applied, which fails the
// deploy (AGENTS.md, "Migrations are fixed once pushed").
//
//   node scripts/migrations-unchanged.mjs <ref>...   compare HEAD with each ref
//   --main      where HEAD left origin/main (their merge base)
//   --pushed    origin/<this branch>, if it has been pushed
//
// Every migration in a ref must be in HEAD, byte for byte. A ref Git doesn't
// have (a first push, or a commit a force push left behind) is skipped,
// saying so. CI runs it with --main and the commit pushed before (ci.yml);
// the pre-push hook with --main and --pushed (.pre-commit-config.yaml).
import { execFileSync } from "node:child_process";

const MIGRATIONS = "netlify/database/migrations";

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function tryGit(args, cwd) {
  try {
    return git(args, cwd);
  } catch {
    return undefined;
  }
}

/** Each migration's blob at `ref`, by path. */
function migrationsAt(ref, cwd) {
  const listing = git(["ls-tree", "-r", ref, "--", MIGRATIONS], cwd);
  return new Map(
    listing
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [meta, path] = line.split("\t");
        return [path, meta.split(" ")[2]];
      }),
  );
}

/** The migrations at `ref` that HEAD changed or doesn't have. */
export function changedSince(ref, cwd = process.cwd()) {
  const head = migrationsAt("HEAD", cwd);
  return [...migrationsAt(ref, cwd)]
    .filter(([path, blob]) => head.get(path) !== blob)
    .map(([path]) => (head.has(path) ? `changed: ${path}` : `gone: ${path}`));
}

/** The refs the arguments name, each resolved to a commit or skipped. */
export function refsFrom(args, cwd = process.cwd()) {
  return args.flatMap((arg) => {
    if (arg === "--main") {
      const base = tryGit(["merge-base", "origin/main", "HEAD"], cwd);
      return [{ name: "where this branch left origin/main", commit: base }];
    }
    if (arg === "--pushed") {
      const branch = tryGit(["symbolic-ref", "--short", "HEAD"], cwd);
      const pushed = branch && tryGit(["rev-parse", "--verify", "--quiet", `origin/${branch}^{commit}`], cwd);
      return [{ name: `origin/${branch ?? "(no branch)"}`, commit: pushed }];
    }
    if (/^0+$/.test(arg) || arg === "") return [];
    return [{ name: arg, commit: tryGit(["rev-parse", "--verify", "--quiet", `${arg}^{commit}`], cwd) }];
  });
}

/** Checks HEAD against each ref the arguments name; returns the lines to print and whether all were unchanged. */
export function check(args, cwd = process.cwd()) {
  const lines = [];
  let ok = true;
  for (const { name, commit } of refsFrom(args, cwd)) {
    if (!commit) {
      lines.push(`Migrations: skipped ${name}, which Git doesn't have here.`);
      continue;
    }
    const changed = changedSince(commit, cwd);
    if (changed.length === 0) {
      lines.push(`Migrations: none changed since ${name}.`);
      continue;
    }
    ok = false;
    lines.push(
      `Migrations changed since ${name}, which may already be applied to a database:`,
      ...changed.map((line) => `  ${line}`),
      `Put each back as it was, and make the change in a new migration (AGENTS.md, "Migrations are fixed once pushed").`,
    );
  }
  return { lines, ok };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { lines, ok } = check(process.argv.slice(2));
  for (const line of lines) console.log(line);
  process.exit(ok ? 0 : 1);
}
