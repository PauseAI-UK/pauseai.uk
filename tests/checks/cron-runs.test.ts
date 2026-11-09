import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Every job runs as a run of the import log: inside asRun()
// (lib/server/import-runs.ts), so that a failure is kept as a failed run and
// emailed about, and what it reports with problem() has a run to go on.
// Without it, a failure reaches only Netlify's logs. Every job runs through
// lib/server/jobs.ts, so this fails on any module it imports, other than the
// import log's own, that doesn't call asRun.

const ROOT = join(__dirname, "..", "..");
const JOBS = "lib/server/jobs.ts";

/** The lib/server modules `source`, at `file`, imports, as paths from the root. */
export function serverImports(file: string, source: ts.SourceFile): string[] {
  const found: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const from = statement.moduleSpecifier.text;
    const path = from.startsWith("@/") ? from.slice(2) : from.startsWith(".") ? join(dirname(file), from) : "";
    if (normalize(path).startsWith("lib/server/")) found.push(`${normalize(path)}.ts`);
  }
  return found;
}

function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

describe("jobs", () => {
  it("reads a module's lib/server imports, by alias or relative to it", () => {
    const code = `
      import "server-only";
      import { NextResponse } from "next/server";
      import { isCronRequest } from "@/lib/server/cron";
      import { importLuma } from "./luma-import";
      import { NIGHTLY } from "@/lib/import-runs";
      import { found } from "../found";`;
    expect(serverImports("lib/server/jobs.ts", parse("jobs.ts", code))).toEqual([
      "lib/server/cron.ts",
      "lib/server/luma-import.ts",
    ]);
  });

  it("the cron route runs its job through lib/server/jobs.ts", () => {
    const route = "app/api/cron/[job]/route.ts";
    expect(serverImports(route, parse(route, readFileSync(join(ROOT, route), "utf8")))).toContain(JOBS);
  });

  it("every job runs as a run of the import log", () => {
    const modules = serverImports(JOBS, parse(JOBS, readFileSync(join(ROOT, JOBS), "utf8")));
    expect(modules).toContain("lib/server/luma-import.ts");
    const outside = modules.filter(
      (module) =>
        module !== "lib/server/import-runs.ts" && !readFileSync(join(ROOT, module), "utf8").includes("asRun("),
    );
    expect(outside, "run the job inside asRun(), so it, its failures and its problems are kept").toEqual([]);
  });
});
