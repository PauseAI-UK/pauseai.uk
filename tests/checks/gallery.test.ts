import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

// The component gallery (app/(tools)/gallery)
// shows every component, so the storyboard pictures each one. This fails on
// an exported component that has no example there: a new one isn't done
// until it's in the gallery. Which variants each needs is judged in review.
//
// A component's examples are in a Component.gallery.tsx beside it, or in one
// of the gallery's own files in _examples/. A component in a staff feature's
// folder has its beside it. A group in _examples/ imports each file of
// examples beside a component, as Next can't look for them as the page runs.
const ROOT = join(__dirname, "..", "..");
const GALLERY = join(ROOT, "app", "(tools)", "gallery");
const EXAMPLES = join(GALLERY, "_examples");
const STAFF_COMPONENTS = join(ROOT, "app", "(staff)", "staff", "_components");

/** Every .tsx under dir, tests left out. */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return tsxFiles(path);
    return entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [path] : [];
  });
}

/** Whether a file is a component's examples, beside it: Component.gallery.tsx, or its client part. */
const isBeside = (path: string) => /\.gallery(\.client)?\.tsx$/.test(path);

/** The file of examples beside a component's file. */
const besideOf = (path: string) => path.replace(/\.tsx$/, ".gallery.tsx");

/** Whether a component's file is in a staff feature's folder: any under _components/ but the kit, ui/. */
function inFeatureFolder(path: string): boolean {
  const [folder, ...rest] = relative(STAFF_COMPONENTS, path).split(sep);
  return rest.length > 0 && folder !== ".." && folder !== "ui";
}

/** The components' files: all of components/, and every _components folder in app/ but the gallery's own. */
function componentFiles(): string[] {
  const inApp = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      if (!entry.isDirectory()) return [];
      const path = join(dir, entry.name);
      if (path === GALLERY) return [];
      return entry.name === "_components" ? tsxFiles(path) : inApp(path);
    });
  return [...tsxFiles(join(ROOT, "components")), ...inApp(join(ROOT, "app"))].filter((path) => !isBeside(path));
}

/**
 * A file's exported components: its exported functions and consts named in
 * PascalCase. A constant in capitals (TOOLS, APPLY_URL) isn't one.
 */
function exportedComponents(source: string): string[] {
  const names = [...source.matchAll(/^export (?:default )?(?:async )?function ([A-Z]\w*)/gm)].map((m) => m[1]);
  names.push(...[...source.matchAll(/^export const ([A-Z]\w*)\s*[:=]/gm)].map((m) => m[1]));
  return names.filter((name) => /[a-z]/.test(name));
}

describe("component gallery", () => {
  const examples = tsxFiles(EXAMPLES)
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
  const has = (name: string, file: string, text: string) =>
    new RegExp(`name: "${name}",\\s*file: "${file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(text);

  it("has an example of every exported component, beside it if it has a file of examples or is in a feature's folder", () => {
    const missing = componentFiles().flatMap((path) => {
      const file = relative(ROOT, path);
      const beside = existsSync(besideOf(path));
      if (!beside && inFeatureFolder(path)) return [`${relative(ROOT, besideOf(path))} (none)`];
      const text = beside ? readFileSync(besideOf(path), "utf8") : examples;
      return exportedComponents(readFileSync(path, "utf8"))
        .filter((name) => !has(name, file, text))
        .map((name) => `${name} (${file})`);
    });
    expect(missing).toEqual([]);
  });

  it("shows every file of examples beside a component in a group of the gallery", () => {
    const besides = [...tsxFiles(join(ROOT, "components")), ...tsxFiles(join(ROOT, "app"))].filter(
      (path) => isBeside(path) && !path.endsWith(".client.tsx"),
    );
    expect(besides.length).toBeGreaterThan(0);
    const unshown = besides
      .map((path) => relative(ROOT, path).replace(/\.tsx$/, ""))
      .filter((path) => !examples.includes(`from "@/${path}"`));
    expect(unshown).toEqual([]);
  });

  it("finds the staff features' folders: those under _components/ but ui/", () => {
    expect(inFeatureFolder(join(STAFF_COMPONENTS, "events", "EventRow.tsx"))).toBe(true);
    expect(inFeatureFolder(join(STAFF_COMPONENTS, "ui", "Band.tsx"))).toBe(false);
    expect(inFeatureFolder(join(STAFF_COMPONENTS, "Notes.tsx"))).toBe(false);
    expect(inFeatureFolder(join(ROOT, "components", "ui", "Button.tsx"))).toBe(false);
  });

  it("finds components exported as functions and as consts, default or not", () => {
    expect(
      exportedComponents(
        [
          "export default function Card() {}",
          "export function Row() {}",
          "export async function Loader() {}",
          "export const Context = createContext(null);",
          "export function helper() {}",
          "export const LIMIT = 3;",
        ].join("\n"),
      ),
    ).toEqual(["Card", "Row", "Loader", "Context"]);
  });
});
