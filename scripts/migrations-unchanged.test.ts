import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, unlinkSync, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { changedSince, check, refsFrom } from "./migrations-unchanged.mjs";

// A throwaway repository with a migrations folder, a "main" that's been
// pushed (origin/main, as a remote-tracking ref) and a branch off it.
let repo: string;
const git = (...args: string[]) =>
  execFileSync("git", args, { cwd: repo, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
const migration = (name: string, sql: string) => writeFileSync(join(repo, "netlify/database/migrations", name), sql);
const commit = (message: string) => {
  git("add", "-A");
  git("commit", "-q", "-m", message);
  return git("rev-parse", "HEAD");
};

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "migrations-unchanged-"));
  git("init", "-q", "-b", "main");
  git("config", "user.email", "jane.smith@example.com");
  git("config", "user.name", "Jane Smith");
  mkdirSync(join(repo, "netlify/database/migrations"), { recursive: true });
  migration("0001_first.sql", "CREATE TABLE a (id int);\n");
  const main = commit("first");
  git("update-ref", "refs/remotes/origin/main", main);
  git("checkout", "-q", "-b", "feature");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe("changedSince", () => {
  it("finds nothing when the branch only adds a migration", () => {
    migration("0002_second.sql", "CREATE TABLE b (id int);\n");
    commit("second");
    expect(changedSince("origin/main", repo)).toEqual([]);
  });

  it("finds a migration changed, and one gone or renamed", () => {
    migration("0001_first.sql", "CREATE TABLE a (id bigint);\n");
    commit("changed");
    expect(changedSince("origin/main", repo)).toEqual(["changed: netlify/database/migrations/0001_first.sql"]);
    renameSync(
      join(repo, "netlify/database/migrations/0001_first.sql"),
      join(repo, "netlify/database/migrations/0002_first.sql"),
    );
    commit("renamed");
    expect(changedSince("origin/main", repo)).toEqual(["gone: netlify/database/migrations/0001_first.sql"]);
  });
});

describe("refsFrom", () => {
  it("resolves --main to the merge base, --pushed to the branch on origin, and a commit as itself", () => {
    const base = git("rev-parse", "origin/main");
    migration("0002_second.sql", "CREATE TABLE b (id int);\n");
    const pushed = commit("second");
    git("update-ref", "refs/remotes/origin/feature", pushed);
    expect(refsFrom(["--main", "--pushed", pushed], repo)).toEqual([
      { name: "where this branch left origin/main", commit: base },
      { name: "origin/feature", commit: pushed },
      { name: pushed, commit: pushed },
    ]);
  });

  it("leaves out an empty or all-zero commit, as on a first push, and can't resolve what Git hasn't got", () => {
    expect(refsFrom(["", "0000000000000000000000000000000000000000"], repo)).toEqual([]);
    expect(refsFrom(["--pushed", "1234567"], repo)).toEqual([
      { name: "origin/feature", commit: undefined },
      { name: "1234567", commit: undefined },
    ]);
  });

  it("names no branch when HEAD is detached", () => {
    git("checkout", "-q", "--detach");
    expect(refsFrom(["--pushed"], repo)).toEqual([{ name: "origin/(no branch)", commit: undefined }]);
  });
});

describe("check", () => {
  it("passes a branch that only adds, saying what it checked and skipped", () => {
    migration("0002_second.sql", "CREATE TABLE b (id int);\n");
    commit("second");
    expect(check(["--main", "--pushed"], repo)).toEqual({
      ok: true,
      lines: [
        "Migrations: none changed since where this branch left origin/main.",
        "Migrations: skipped origin/feature, which Git doesn't have here.",
      ],
    });
  });

  it("fails a migration changed after it was pushed on the branch, and says what to do", () => {
    migration("0002_second.sql", "CREATE TABLE b (id int);\n");
    git("update-ref", "refs/remotes/origin/feature", commit("second"));
    unlinkSync(join(repo, "netlify/database/migrations/0002_second.sql"));
    commit("gone");
    const { ok, lines } = check(["--main", "--pushed"], repo);
    expect(ok).toBe(false);
    expect(lines).toEqual([
      "Migrations: none changed since where this branch left origin/main.",
      "Migrations changed since origin/feature, which may already be applied to a database:",
      "  gone: netlify/database/migrations/0002_second.sql",
      'Put each back as it was, and make the change in a new migration (AGENTS.md, "Migrations are fixed once pushed").',
    ]);
  });
});
