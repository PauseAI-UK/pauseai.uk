import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

// The site's header and footer are drawn only by SiteFrame, which draws
// them once however many layouts a page is inside (FrameOnce). A layout or
// page that drew Nav or Footer itself could put a second header and footer
// inside another's, as the 404 page once did inside the tools' layout. The
// gallery shows each on its own, and tests render them, so neither counts.

const ROOT = join(__dirname, "..", "..");
const ALLOWED = new Set(["components/layout/SiteFrame.tsx"]);

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "_examples" || entry.name === "node_modules" ? [] : sources(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

it("draws the site's header and footer only in SiteFrame", () => {
  const drawing = [...sources(join(ROOT, "app")), ...sources(join(ROOT, "components"))]
    .filter((path) => /from "(@\/components\/layout|\.)\/(Nav|Footer)"/.test(readFileSync(path, "utf8")))
    .map((path) => relative(ROOT, path))
    .filter((path) => !ALLOWED.has(path));
  expect(drawing).toEqual([]);
});
