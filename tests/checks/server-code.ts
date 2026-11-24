import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { featureLibFolders } from "../../eslint.config.mjs";

// The code where jobs and requests run, for the checks of how it handles
// what goes wrong (caught-errors.test.ts, problem-reporting.test.ts):
// lib/server, each feature's folder of logic, netlify/functions, and under
// app/ what the server runs: every route handler, page and layout, each file
// of Server Actions, and each .server.ts.

const ROOT = join(__dirname, "..", "..");
const DIRS = ["lib/server", ...featureLibFolders(), "netlify/functions"];

function codeFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return codeFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Whether a file under app/ is the server's, by its name or its "use server". */
export function isAppServerFile(file: string, text: string): boolean {
  return /(^|\/)(route\.ts|page\.tsx|layout\.tsx)$|\.server\.tsx?$/.test(file) || /^\s*["']use server["']/.test(text);
}

/** Every file of server code, parsed, named by its path from the repo's root. */
export function serverSources(): ts.SourceFile[] {
  const read = (path: string) => [relative(ROOT, path), readFileSync(path, "utf8")] as const;
  const files = [
    ...DIRS.flatMap((dir) => codeFiles(join(ROOT, dir))).map(read),
    ...codeFiles(join(ROOT, "app"))
      .map(read)
      .filter(([file, text]) => isAppServerFile(file, text)),
  ];
  return files.map(([file, text]) => parse(file, text));
}

export function parse(file: string, text: string): ts.SourceFile {
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
