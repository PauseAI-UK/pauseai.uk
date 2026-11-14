import { readFileSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { featureLibFolders } from "../../eslint.config.mjs";

// Every job runs as a run of the import log: inside asRun()
// (lib/server/import-runs.server.ts), so that a failure is kept as a failed run and
// emailed about, and what it reports with problem() has a run to go on.
// Without it, a failure reaches only Netlify's logs. Every job runs through
// lib/jobs/jobs.server.ts, so this fails on any server module it imports (from
// lib/server/ or a feature's lib/ folder), but for types and the import
// log's own, that doesn't call asRun.

const ROOT = join(__dirname, "..", "..");
const JOBS = "lib/jobs/jobs.server.ts";
const SERVER = ["lib/server", ...featureLibFolders()];

/** The server modules `source`, at `file`, imports, as paths from the root: lib/server's and the features'. */
export function serverImports(file: string, source: ts.SourceFile): string[] {
  const found: string[] = [];
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    // A type runs nothing.
    if (statement.importClause?.isTypeOnly) continue;
    const from = statement.moduleSpecifier.text;
    const path = from.startsWith("@/") ? from.slice(2) : from.startsWith(".") ? join(dirname(file), from) : "";
    if (SERVER.some((folder) => normalize(path).startsWith(`${folder}/`))) found.push(`${normalize(path)}.ts`);
  }
  return found;
}

function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
}

describe("jobs", () => {
  it("reads a module's server imports, by alias or relative to it", () => {
    const code = `
      import "server-only";
      import { NextResponse } from "next/server";
      import { isCronRequest } from "@/lib/jobs/cron.server";
      import { readGmail } from "./gmail-reading.server";
      import { query } from "@/lib/server/db.server";
      import { tagEvents } from "@/lib/events/tagging.server";
      import { NIGHTLY } from "@/lib/import-runs";
      import type { Body } from "@/lib/politicians/import-changes";
      import { found } from "../found";`;
    expect(serverImports("lib/jobs/jobs.server.ts", parse("jobs.ts", code))).toEqual([
      "lib/jobs/cron.server.ts",
      "lib/jobs/gmail-reading.server.ts",
      "lib/server/db.server.ts",
      "lib/events/tagging.server.ts",
    ]);
  });

  it("the cron route runs its job through lib/jobs/jobs.server.ts", () => {
    const route = "app/api/cron/[job]/route.ts";
    expect(serverImports(route, parse(route, readFileSync(join(ROOT, route), "utf8")))).toContain(JOBS);
  });

  it("every job runs as a run of the import log", () => {
    const modules = serverImports(JOBS, parse(JOBS, readFileSync(join(ROOT, JOBS), "utf8")));
    expect(modules).toContain("lib/events/luma-import.server.ts");
    const outside = modules.filter(
      (module) =>
        module !== "lib/server/import-runs.server.ts" && !readFileSync(join(ROOT, module), "utf8").includes("asRun("),
    );
    expect(outside, "run the job inside asRun(), so it, its failures and its problems are kept").toEqual([]);
  });
});
