#!/usr/bin/env node
// Fails while any copy is a placeholder, so none can ship:
//
//   npm run placeholders
//
// Agents never write final copy (AGENTS.md, "Never write final copy"). Where
// code needs words that a person hasn't written yet, they put in a draft that
// starts with the mark U+2042. This lists each line of the repo that has the
// mark, as file:line, and exits 1 if there are any. `npm run lint` ends
// with it, so CI's lint job and `npm run build` run it, and the gate runs it
// as a command of its own. It isn't a Vitest test, as a failing test would
// stop `npm test` reporting coverage for as long as a branch's copy waits
// for approval. `npm run copy` shows the copy waiting.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** The placeholder mark, by its code point, so this file doesn't have it. */
export const MARK = String.fromCodePoint(0x2042);

/** The rule itself has to mention the mark. */
const ALLOWED = new Set(["AGENTS.md"]);

/**
 * Generated, installed or local-only: never part of what ships. .netlify is
 * the Next.js runtime plugin's bundled functions, which copy the whole repo
 * (AGENTS.md included) into the serverless handler; Netlify's build cache can
 * leave one on disk from an earlier build before this one regenerates it.
 */
const SKIP_DIRS = new Set([
  ".git",
  ".netlify",
  ".next",
  ".vitest",
  "node_modules",
  "coverage",
  "playwright-report",
  "test-results",
  "blob-report",
  "tmp",
]);

/** Text files only. Images and PDFs are skipped: their bytes could contain the mark's UTF-8 encoding by chance. */
const TEXT_FILE = /\.(tsx?|mjs|cjs|js|json|md|mdx|css|html|txt|svg|ya?ml|csv|toml)$/;

/**
 * Each line under `root` that has the mark, as "file:line", in the order the
 * folders list them.
 *
 * @param {string} root
 * @returns {string[]}
 */
export function linesWithMark(root, dir = root) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    const relative = path.slice(root.length + 1);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) found.push(...linesWithMark(root, path));
    } else if (entry.isFile() && TEXT_FILE.test(entry.name) && !ALLOWED.has(relative)) {
      readFileSync(path, "utf8")
        .split("\n")
        .forEach((line, index) => {
          if (line.includes(MARK)) found.push(`${relative}:${index + 1}`);
        });
    }
  }
  return found;
}

/**
 * What the command prints, and its exit code.
 *
 * @param {string[]} lines
 * @returns {{ code: number, output: string }}
 */
export function report(lines) {
  if (lines.length === 0) return { code: 0, output: "No placeholder copy." };
  return {
    code: 1,
    output: [
      `Placeholder copy (${MARK}) is left on ${lines.length === 1 ? "1 line" : `${lines.length} lines`}:`,
      ...lines.map((line) => `  ${line}`),
      'A person writes the final words (AGENTS.md, "Never write final copy"). `npm run copy` shows them all on one page.',
    ].join("\n"),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { code, output } = report(linesWithMark(process.cwd()));
  console.log(output);
  process.exit(code);
}
