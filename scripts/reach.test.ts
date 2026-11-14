import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { isSiteCode, mostReaching, newestRuns, reachLines } from "./reach.mjs";
import { reachContext } from "./storyboard-reach.mjs";

// A checkout of a few files: two pages that share a component and a loader, and the specs that open them.
const FILES: Record<string, string> = {
  "app/layout.tsx": `export default function Root() {}`,
  "app/(staff)/staff/letters/page.tsx": `import { Table } from "@/components/Table";\nimport "@/lib/letters";\nexport default Table;`,
  "app/(staff)/staff/events/page.tsx": `import { Table } from "@/components/Table";\nexport default Table;`,
  "components/Table.tsx": `import "@/lib/format";\nexport function Table() {}`,
  "lib/format.ts": `export const format = 1;`,
  "lib/letters.ts": `export const letters = 1;`,
  "lib/letters.test.ts": `import "./letters";`,
  "tests/storyboard/letters.spec.ts": `import "../steps";`,
  "tests/storyboard/events.spec.ts": `import "../steps";`,
  "tests/steps.ts": `export const step = 1;`,
};

let root: string;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "reach-"));
  for (const [path, text] of Object.entries(FILES)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

const run = (section: string, flow: string, opened: string[]) => ({
  key: `desktop|${section}|${flow}`,
  section,
  flow,
  opened,
});
const letters = run("letters", "A letter", ["/staff/letters"]);
const events = run("events", "An event", ["/staff/events"]);

describe("isSiteCode", () => {
  it("is the site's files, not tests, specs or scripts", () => {
    expect(["lib/format.ts", "app/layout.tsx", "components/Table.tsx"].every(isSiteCode)).toBe(true);
    expect(["lib/letters.test.ts", "tests/steps.ts", "scripts/reach.mjs", "x.spec.ts"].some(isSiteCode)).toBe(false);
  });
});

describe("mostReaching", () => {
  it("counts the flows that reach each of the site's files, most first, then by path", () => {
    expect(mostReaching([letters, events], reachContext(root))).toEqual([
      { path: "app/layout.tsx", flows: 2 },
      { path: "components/Table.tsx", flows: 2 },
      { path: "lib/format.ts", flows: 2 },
      { path: "app/(staff)/staff/events/page.tsx", flows: 1 },
      { path: "app/(staff)/staff/letters/page.tsx", flows: 1 },
      { path: "lib/letters.ts", flows: 1 },
    ]);
  });

  it("keeps to the files under a folder, if asked", () => {
    expect(mostReaching([letters, events], reachContext(root), "lib/").map(({ path }) => path)).toEqual([
      "lib/format.ts",
      "lib/letters.ts",
    ]);
  });
});

describe("reachLines", () => {
  it("says each file's flows of all of them, as many as asked", () => {
    const found = [
      { path: "lib/format.ts", flows: 12 },
      { path: "lib/letters.ts", flows: 3 },
    ];
    expect(reachLines(found, 120, 1)).toEqual([" 12/120  lib/format.ts"]);
    expect(reachLines(found, 120, Infinity)).toEqual([" 12/120  lib/format.ts", "  3/120  lib/letters.ts"]);
  });
});

describe("newestRuns", () => {
  it("takes the desktop flows that say what they opened, from the kept tree with the most", () => {
    const store = join(root, "store");
    const keep = (tree: string, frames: object[]) => {
      mkdirSync(join(store, "trees"), { recursive: true });
      writeFileSync(join(store, "trees", `${process.platform}-${tree}.json`), JSON.stringify({ frames }));
    };
    keep("t1", [{ section: "letters", flow: "A letter", viewport: "desktop", opened: [] }]);
    keep("t2", [
      { section: "letters", flow: "A letter", viewport: "desktop", opened: ["/staff/letters"] },
      { section: "events", flow: "An event", opened: ["/staff/events"] },
      { section: "events", flow: "An event", viewport: "phone", opened: ["/staff/events"] },
      { section: "events", flow: "Not recorded", viewport: "desktop" },
    ]);
    expect(newestRuns(store).map((r) => r.key)).toEqual(["desktop|letters|A letter", "desktop|events|An event"]);
    expect(newestRuns(join(root, "none"))).toEqual([]);
  });
});
