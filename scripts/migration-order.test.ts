import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  check,
  highest,
  LISTED_FILES,
  migrationsOnDisk,
  openPrs,
  nextFree,
  numberOf,
  openPrClashes,
  orderProblems,
  prefix,
} from "./migration-order.mjs";

const pr = (number: number, headRefName: string, ...paths: string[]) => ({
  number,
  headRefName,
  files: paths.map((path) => ({ path })),
});
const M = "netlify/database/migrations";

describe("numberOf, prefix and highest", () => {
  it("reads a migration's number, and nothing from another file", () => {
    expect(numberOf("0098_letter_events.sql")).toBe(98);
    expect(numberOf("20261110143000_timestamped.sql")).toBe(20261110143000);
    expect(numberOf("README.md")).toBeUndefined();
    expect(numberOf("0098_Capitals.sql")).toBeUndefined();
  });

  it("pads a number to four digits, and finds the highest, or 0", () => {
    expect(prefix(99)).toBe("0099");
    expect(highest(["0001_a.sql", "0012_b.sql", "notes.txt"])).toBe(12);
    expect(highest([])).toBe(0);
  });
});

describe("orderProblems", () => {
  const main = ["0097_a.sql", "0098_b.sql"];

  it("passes migrations numbered after main's last, and main's own", () => {
    expect(orderProblems(main, [...main, "0099_c.sql", "0100_d.sql"])).toEqual([]);
    expect(orderProblems(main, main)).toEqual([]);
  });

  it("refuses one at or below main's last, as Netlify would", () => {
    expect(orderProblems(main, [...main, "0098_c.sql"])).toEqual([
      "0098_c.sql isn't numbered after main's last, 0098_b.sql: Netlify would refuse it as out of order.",
    ]);
    expect(orderProblems(main, ["0097_a.sql", "0050_old.sql"])).toHaveLength(1);
  });

  it("refuses two added with the same number", () => {
    expect(orderProblems(main, [...main, "0099_c.sql", "0099_d.sql"])).toEqual([
      "0099_c.sql and 0099_d.sql have the same number.",
    ]);
  });

  it("passes anything after an empty main", () => {
    expect(orderProblems([], ["0001_a.sql"])).toEqual([]);
  });
});

describe("openPrClashes and nextFree", () => {
  const prs = [
    pr(276, "events-grouping", `${M}/0099_event_tags.sql`, "app/page.tsx"),
    pr(277, "this-branch", `${M}/0099_mine.sql`),
    pr(278, "other", `${M}/0101_later.sql`),
  ];

  it("names another open pull request with one of this branch's numbers, not this branch's own", () => {
    expect(openPrClashes(["0099_mine.sql"], prs, "this-branch")).toEqual([
      "#276 (events-grouping) adds 0099_event_tags.sql, the same number as 0099_mine.sql.",
    ]);
    expect(openPrClashes(["0100_mine.sql"], prs, "this-branch")).toEqual([]);
  });

  it("gives a branch's first migration the number after main's and every open pull request's", () => {
    expect(nextFree(["0098_b.sql"], ["0098_b.sql"])).toBe("0099");
    expect(nextFree(["0098_b.sql"], ["0098_b.sql"], prs)).toBe("0102");
  });

  it("gives a branch's later migrations the number after its own last, skipping none another pull request has", () => {
    expect(nextFree(["0098_b.sql"], ["0098_b.sql", "0099_mine.sql"])).toBe("0100");
    expect(nextFree(["0098_b.sql"], ["0098_b.sql", "0099_mine.sql"], prs)).toBe("0100");
  });
});

describe("openPrs", () => {
  it("reads every file of a pull request whose list gh cut short, and none again of one it didn't", () => {
    const many = Array.from({ length: LISTED_FILES }, (_, i) => ({ path: `app/${i}.tsx` }));
    const calls: string[][] = [];
    const run = (args: string[]) => {
      calls.push(args);
      if (args[0] === "pr")
        return JSON.stringify([
          { number: 277, headRefName: "big", files: many },
          { number: 279, headRefName: "small", files: [{ path: "scripts/a.mjs" }] },
        ]);
      return `app/0.tsx\n${M}/0099_hidden.sql\n`;
    };
    const prs = openPrs("/repo", run)!;
    expect(prs[0].files).toEqual([{ path: "app/0.tsx" }, { path: `${M}/0099_hidden.sql` }]);
    expect(prs[1].files).toEqual([{ path: "scripts/a.mjs" }]);
    expect(calls.filter(([command]) => command === "api")).toEqual([
      ["api", "--paginate", "repos/{owner}/{repo}/pulls/277/files", "--jq", ".[].filename"],
    ]);
  });

  it("is undefined when gh can't say", () => {
    expect(
      openPrs("/repo", () => {
        throw new Error("gh: not logged in");
      }),
    ).toBeUndefined();
  });
});

// A throwaway repository whose origin/main has two migrations.
describe("check", () => {
  let repo: string;
  const git = (...args: string[]) => execFileSync("git", args, { cwd: repo, encoding: "utf8" }).trim();
  const migration = (name: string) => writeFileSync(join(repo, M, name), "SELECT 1;\n");

  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), "migration-order-"));
    git("init", "-q", "-b", "main");
    git("config", "user.email", "jane.smith@example.com");
    git("config", "user.name", "Jane Smith");
    mkdirSync(join(repo, M), { recursive: true });
    migration("0001_first.sql");
    migration("0002_second.sql");
    git("add", "-A");
    git("commit", "-q", "-m", "first");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
    git("checkout", "-q", "-b", "feature");
  });

  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  it("passes a checkout that adds nothing, and says the next number", () => {
    expect(check({ cwd: repo })).toEqual({
      ok: true,
      lines: ["Migrations: none added.", "Migrations: the next free number is 0003."],
    });
  });

  it("passes one after main's, committed or not", () => {
    migration("0003_third.sql");
    expect(migrationsOnDisk(repo)).toContain("0003_third.sql");
    expect(check({ cwd: repo }).lines[0]).toBe("Migrations: 0003_third.sql after main's last.");
  });

  it("fails one that main has overtaken, saying the number to use", () => {
    migration("0002_mine.sql");
    const { ok, lines } = check({ cwd: repo });
    expect(ok).toBe(false);
    expect(lines.join("\n")).toContain("0002_mine.sql isn't numbered after main's last, 0002_second.sql");
    expect(lines.join("\n")).toContain("from 0003.");
  });

  it("warns of an open pull request with the same number, and says when GitHub couldn't be asked", () => {
    migration("0003_mine.sql");
    const { ok, lines } = check({ cwd: repo, prs: [pr(9, "elsewhere", `${M}/0003_theirs.sql`)] });
    expect(ok).toBe(true);
    expect(lines).toContain("  #9 (elsewhere) adds 0003_theirs.sql, the same number as 0003_mine.sql.");
    expect(lines.at(-1)).toBe("Migrations: the next free number is 0004.");
    expect(check({ cwd: repo, prs: [] }).lines).not.toContain(
      "Warning: another open pull request has the same number:",
    );
    expect(check({ cwd: repo, prs: null }).lines).toContain(
      "Migrations: couldn't ask GitHub for the open pull requests' (gh), so didn't check them.",
    );
  });

  it("finds no migrations where there's no folder", () => {
    expect(migrationsOnDisk(tmpdir())).toEqual([]);
  });
});
