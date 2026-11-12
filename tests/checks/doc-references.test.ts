import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

// The docs name code by its path (`lib/server/db.ts`) and cite each other by
// heading (`docs/testing.md`, "Coverage"). A rename leaves either pointing at
// nothing, and nothing else would say so. This reads every Markdown file and
// fails on a path in backticks that isn't in the repo, and on a cited
// heading, or bold lead-in, that the cited doc doesn't have. Code and
// workflows cite the docs' headings in their comments too, so those are
// checked as well. Names of functions and columns aren't checked.

const ROOT = join(__dirname, "..", "..");

/** Generated, installed or local-only. */
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

/**
 * Markdown whose paths aren't checked: a plan or an investment names files it
 * proposes, which aren't there yet. Their cited headings still are.
 */
const PROPOSES = /^(plans|investments)\//;

/** Paths the docs name that are written by a command, not kept in the repo. */
const GENERATED = new Set(["investments/ranked.txt"]);

/** Files whose comments cite the docs. */
const CITES = /\.(md|[cm]?[jt]sx?|ya?ml|toml|css|sql)$/;

function filesUnder(dir: string, root = dir): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : filesUnder(path, root);
    return [path.slice(root.length + 1)];
  });
}

/** What's at the top of the repo, kept in Git or not ignored: the first part of any path the docs could name. */
const topLevel = (root: string) => readdirSync(root).filter((name) => !SKIP_DIRS.has(name));

/**
 * The repo paths `markdown` names in backticks, each with its line: a span
 * with no spaces, a slash in it, and a first part that's at the top of the
 * repo. A span that stands for many paths (a glob, `<name>`, an ellipsis) is
 * left out, as are a line number or a trailing slash on the end.
 */
export function pathsNamed(markdown: string, top: string[]): { path: string; line: number }[] {
  const found: { path: string; line: number }[] = [];
  let fenced = false;
  markdown.split("\n").forEach((text, index) => {
    if (/^\s*(```|~~~)/.test(text)) fenced = !fenced;
    if (fenced) return;
    for (const [, span] of text.matchAll(/`([^`\s]+)`/g)) {
      if (!span.includes("/") || /[*<>{}$…]|\.\.\./.test(span)) continue;
      const path = span.replace(/:\d+(-\d+)?$/, "").replace(/\/$/, "");
      if (top.includes(path.split("/")[0])) found.push({ path, line: index + 1 });
    }
  });
  return found;
}

/** A doc's path as it's cited: one of ours, by its path from the top of the repo. */
const DOC = String.raw`((?:[\w.-]+/)*[\w.-]+\.md)`;
/** What can sit between the parts of a citation: spaces, and a comment's markers where it wraps onto the next line. */
const GAP = String.raw`(?:\s|//|#|\*|--)`;
/**
 * A cited doc, in backticks or as a link or neither, then the heading in
 * double quotes, after a comma or in brackets: `docs/testing.md`, "Coverage"
 * or `docs/testing.md` ("Coverage"). The heading may wrap onto the next line.
 */
const CITATION = new RegExp(
  String.raw`(?<![\w/.-])\`?${DOC}[\`)]*(?:,${GAP}+|${GAP}+\()"([^"\n]+(?:\n[^"\n]+)?)"`,
  "g",
);

/** A heading as it's cited, on one line, without a comment's markers where it wrapped. */
const unwrapped = (heading: string) => heading.replace(/\s*\n\s*(?:\/\/|#|\*|--)?\s*/g, " ").trim();

/** Each `doc, "Heading"` in `text`, with its line. */
export function headingsCited(text: string): { doc: string; heading: string; line: number }[] {
  return [...text.matchAll(CITATION)].map((match) => ({
    doc: match[1],
    heading: unwrapped(match[2]),
    line: text.slice(0, match.index).split("\n").length,
  }));
}

/** Text as it's compared: without Markdown's backticks, a section's number at the start or a full stop on the end. */
const plain = (text: string) =>
  text
    .replaceAll("`", "")
    .replace(/^\d+\.\s+/, "")
    .replace(/[.:]$/, "")
    .trim();

/** Whether `path` is there: a file or folder, or a module named without its extension (`components/ui/Table`). */
function inRepo(root: string, path: string): boolean {
  if (existsSync(join(root, path))) return true;
  const folder = join(root, dirname(path));
  return existsSync(folder) && readdirSync(folder).some((name) => name.startsWith(`${basename(path)}.`));
}

/** What a doc can be cited by: its headings, and the bold words a paragraph or list item opens with. */
export function headingsOf(markdown: string): Set<string> {
  const found = new Set<string>();
  for (const [, heading] of markdown.matchAll(/^#{1,6}\s+(.+?)\s*$/gm)) found.add(plain(heading));
  for (const [, lead] of markdown.matchAll(/^\s*(?:[-*]\s+|\d+\.\s+)?\*\*(.+?)\*\*/gm)) found.add(plain(lead));
  return found;
}

/** Every reference under `root` that points at nothing, as "file:line  what". */
export function brokenReferences(root: string): string[] {
  const top = topLevel(root);
  const headings = new Map<string, Set<string> | undefined>();
  const headingsIn = (doc: string) => {
    if (!headings.has(doc)) {
      headings.set(doc, existsSync(join(root, doc)) ? headingsOf(readFileSync(join(root, doc), "utf8")) : undefined);
    }
    return headings.get(doc);
  };
  return filesUnder(root)
    .filter((file) => CITES.test(file))
    .flatMap((file) => {
      const text = readFileSync(join(root, file), "utf8");
      const paths =
        file.endsWith(".md") && !PROPOSES.test(file)
          ? pathsNamed(text, top)
              .filter(({ path }) => !GENERATED.has(path) && !inRepo(root, path))
              .map(({ path, line }) => `${file}:${line}  \`${path}\` isn't in the repo`)
          : [];
      const cited = headingsCited(text).flatMap(({ doc, heading, line }) => {
        const has = headingsIn(doc);
        // A doc that isn't one of ours, by a path from the top, is some other project's.
        if (!has || has.has(plain(heading))) return [];
        return [`${file}:${line}  \`${doc}\` has no heading or bold lead-in "${heading}"`];
      });
      return [...paths, ...cited];
    });
}

/** A folder holding `files`, each a path and its text. */
function folderOf(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "doc-references-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe("the docs' references", () => {
  it("every path the docs name is in the repo, and every heading cited is in its doc", () => {
    expect(brokenReferences(ROOT)).toEqual([]);
  });

  // The examples below cite docs the repo doesn't have (docs/guide.md), so this file passes its own check.

  it("takes a span in backticks for a path when it starts at the top of the repo", () => {
    const markdown = [
      "The pool is in `lib/server/db.ts`, and `lib/server/` holds the rest.",
      "See `lib/server/db.ts:12` and `components/ui/Table`.",
      "Not paths: `npm run gate`, `/staff/errors`, `tmp/gate/test.log`, `node_modules/.vitest-cache`, `db.ts`.",
      "Many paths: `lib/content/<feature>.ts`, `netlify/functions/*/*.ts`, `app/**/*.{ts,tsx}`, `lib/…`.",
      "```bash",
      "cat `lib/server/gone.ts`",
      "```",
    ].join("\n");
    expect(pathsNamed(markdown, ["lib", "components"])).toEqual([
      { path: "lib/server/db.ts", line: 1 },
      { path: "lib/server", line: 1 },
      { path: "lib/server/db.ts", line: 2 },
      { path: "components/ui/Table", line: 2 },
    ]);
  });

  it("finds a heading cited after a comma or in brackets, in backticks, as a link or bare, and wrapped in a comment", () => {
    expect(
      headingsCited(
        [
          'See `docs/guide.md`, "Coverage".',
          'The gallery (`docs/guide.md` ("The component gallery")).',
          'Set up in [docs/setup.md](docs/setup.md), "Deploying".',
          '// Production\'s collation (docs/setup.md, "Collation").',
          "// It makes its own database (docs/guide.md,",
          '// "Where Postgres',
          '// is").',
          '`NOTES.md`, "Never write final copy"',
          'A file called "notes.md", "and another".',
        ].join("\n"),
      ),
    ).toEqual([
      { doc: "docs/guide.md", heading: "Coverage", line: 1 },
      { doc: "docs/guide.md", heading: "The component gallery", line: 2 },
      { doc: "docs/setup.md", heading: "Deploying", line: 3 },
      { doc: "docs/setup.md", heading: "Collation", line: 4 },
      { doc: "docs/guide.md", heading: "Where Postgres is", line: 5 },
      { doc: "NOTES.md", heading: "Never write final copy", line: 8 },
    ]);
  });

  it("knows a doc by its headings, numbered or in backticks, and by its bold lead-ins", () => {
    const headings = headingsOf(
      ["# Testing", "## 6. Tests", "### `npm run gate`", "- **Ports.** The storyboard…", "**Tables** (`Table`)."].join(
        "\n",
      ),
    );
    expect([...headings]).toEqual(["Testing", "Tests", "npm run gate", "Ports", "Tables"]);
  });

  it("would spot a path that's gone and a heading that isn't there, but lets a plan name a file it proposes", () => {
    const root = folderOf({
      "lib/db.ts": "",
      "components/Table.tsx": "",
      "docs/guide.md": "# Testing\n\n## Coverage\n",
      "docs/structure.md": [
        "The pool is in `lib/db.ts`, the table is `components/Table`, the list is `investments/ranked.txt`.",
        'The old one was `lib/gone.ts` (`docs/guide.md`, "Coverage").',
        'See `docs/guide.md`, "The storyboard", and `vitest/README.md`, "Another project\'s".',
      ].join("\n"),
      "plans/next.md": 'Add `lib/proposed.ts` (`docs/guide.md`, "Sharding").',
      "investments/ranked.txt": "",
      "lib/db.test.ts": '// Each file has its own database (docs/guide.md, "Where Postgres is").\n',
      "node_modules/pkg/README.md": "`lib/nothing.ts`",
    });
    expect(brokenReferences(root).sort()).toEqual([
      "docs/structure.md:2  `lib/gone.ts` isn't in the repo",
      'docs/structure.md:3  `docs/guide.md` has no heading or bold lead-in "The storyboard"',
      'lib/db.test.ts:1  `docs/guide.md` has no heading or bold lead-in "Where Postgres is"',
      'plans/next.md:1  `docs/guide.md` has no heading or bold lead-in "Sharding"',
    ]);
  });
});
