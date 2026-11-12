import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { linesWithMark, MARK, report } from "./placeholders.mjs";

/** A folder holding `files`, each a path and its text. */
function folderOf(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "placeholders-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe("linesWithMark", () => {
  it("names each line that has the mark, in any folder", () => {
    const root = folderOf({
      "lib/content/tool.ts": `export const copy = {\n  save: "${MARK} Save it",\n  done: "Saved",\n  undo: \`${MARK} Undo\`,\n};\n`,
      "app/page.tsx": `<p>${MARK} Welcome</p>\n`,
      "docs/notes.md": "Nothing to approve here.\n",
    });
    expect(linesWithMark(root).sort()).toEqual(["app/page.tsx:1", "lib/content/tool.ts:2", "lib/content/tool.ts:4"]);
  });

  it("leaves out AGENTS.md at the top, which states the rule, but not one further down", () => {
    const root = folderOf({ "AGENTS.md": `Start it with ${MARK}.\n`, "backup/AGENTS.md": `${MARK} A draft\n` });
    expect(linesWithMark(root)).toEqual(["backup/AGENTS.md:1"]);
  });

  it("leaves out what's generated, installed or local, and files that aren't text", () => {
    const root = folderOf({
      "node_modules/pkg/index.js": MARK,
      ".next/server/page.js": MARK,
      "tmp/worktrees/other/lib/copy.ts": MARK,
      "public/images/photo.png": MARK,
      "lib/node_modules/pkg/index.js": MARK,
    });
    expect(linesWithMark(root)).toEqual([]);
  });
});

describe("report", () => {
  it("passes when there are none", () => {
    expect(report([])).toEqual({ code: 0, output: "No placeholder copy." });
  });

  it("fails with each line, and says how many", () => {
    const one = report(["lib/a.ts:3"]);
    expect(one.code).toBe(1);
    expect(one.output).toContain("is left on 1 line:\n  lib/a.ts:3\n");
    expect(report(["lib/a.ts:3", "lib/b.ts:9"]).output).toContain("is left on 2 lines:\n  lib/a.ts:3\n  lib/b.ts:9\n");
  });
});
