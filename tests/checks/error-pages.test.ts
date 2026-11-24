import { existsSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

// A page that throws, or whose Server Action does, is replaced by the
// nearest error.tsx above it, inside that folder's layout
// (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).
// With none, it's the root's (app/global-error.tsx), which replaces the
// whole document: the header, the footer, the staff navigation. So every
// layout has an error.tsx beside it, and what it lays out stays. This fails
// on a layout.tsx without one, but the root's, whose error page is
// global-error.tsx, and those in a folder Next doesn't route (_examples).

const ROOT = join(__dirname, "..", "..");
const APP = join(ROOT, "app");

function layoutFolders(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory()) return entry.name === "layout.tsx" && dir !== APP ? [dir] : [];
    return entry.name.startsWith("_") ? [] : layoutFolders(join(dir, entry.name));
  });
}

it("every layout but the root's has an error.tsx beside it, so an error keeps what it lays out", () => {
  const folders = layoutFolders(APP);
  expect(folders.length).toBeGreaterThan(0);
  const without = folders.filter((folder) => !existsSync(join(folder, "error.tsx"))).map((f) => relative(ROOT, f));
  expect(
    without,
    "add an error.tsx that renders ErrorMain (components/layout/ErrorMain.tsx), or StaffError beside the staff navigation",
  ).toEqual([]);
});
