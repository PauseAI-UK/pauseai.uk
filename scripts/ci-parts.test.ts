import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { flowsForPart, reachedForCi, reachedLine } from "./ci-parts.mjs";
import { RECORDING, reachContext } from "./storyboard-reach.mjs";

describe("flowsForPart", () => {
  it("deals a part's lines for --test-list in turn by key, so a section's flows are spread between the parts", () => {
    const listed = new Map(
      ["desktop|gallery|b", "desktop|gallery|a", "desktop|audit-log|x", "phone|gallery|a"].map((key) => [
        key,
        `line ${key}`,
      ]),
    );
    expect(flowsForPart(listed, 1, 2)).toEqual(["line desktop|audit-log|x", "line desktop|gallery|b"]);
    expect(flowsForPart(listed, 2, 2)).toEqual(["line desktop|gallery|a", "line phone|gallery|a"]);
    expect(flowsForPart(new Map(), 1, 3)).toEqual([]);
  });
});

describe("reachedForCi", () => {
  // A site of a home page and a letters page, and the flows that open them.
  const FILES: Record<string, string> = {
    "app/(site)/page.tsx": `import "@/components/Hero";\nexport default 1;`,
    "components/Hero.tsx": `export default 1;`,
    "app/(staff)/staff/letters/page.tsx": `import "@/lib/letters";\nexport default 1;`,
    "lib/letters.ts": `export default 1;`,
    "proxy.ts": `export const config = {};`,
    "tests/storyboard/home.spec.ts": `export default 1;`,
    "tests/storyboard/staff.spec.ts": `export default 1;`,
    "tests/storyboard/other.spec.ts": `export default 1;`,
  };
  let root: string;
  beforeAll(() => {
    root = mkdtempSync(join(tmpdir(), "ci-parts-"));
    for (const [path, text] of Object.entries(FILES)) {
      mkdirSync(join(root, dirname(path)), { recursive: true });
      writeFileSync(join(root, path), text);
    }
  });
  afterAll(() => rmSync(root, { recursive: true, force: true }));

  const others = Array.from({ length: 10 }, (_, n) => `desktop|other|Flow ${n}`);
  const opened: Record<string, string[]> = {
    "desktop|home|The home page": ["/"],
    "phone|home|The home page": ["/"],
    "desktop|staff|The letters": ["/staff/letters"],
    ...Object.fromEntries(others.map((key) => [key, ["/elsewhere"]])),
  };
  const keys = [...Object.keys(opened), "desktop|staff|A new flow"];
  const choose = (files: string[], recording = RECORDING) =>
    reachedForCi({
      keys,
      map: { recording, flows: opened },
      changed: { files, addedOrDeleted: [] },
      context: reachContext(root),
      seed: "main",
    });

  it("runs every flow with no record of what main's flows opened", () => {
    expect(
      reachedForCi({
        keys,
        map: undefined,
        changed: { files: [], addedOrDeleted: [] },
        context: reachContext(root),
        seed: "main",
      }),
    ).toBeUndefined();
  });

  it("runs the flows a change reaches, those main has no record of, and six spot checks of the rest", () => {
    const chosen = choose(["lib/letters.ts"])!;
    expect(chosen.spot).toHaveLength(6);
    expect(chosen.run).toEqual(new Set(["desktop|staff|The letters", "desktop|staff|A new flow", ...chosen.spot]));
    expect(chosen.spot.every((key) => key !== "desktop|staff|The letters")).toBe(true);
    // The same spot checks for the same commit of main, others for another.
    expect(choose(["lib/letters.ts"])!.spot).toEqual(chosen.spot);
    expect(choose(["lib/letters.ts"])!.spot).not.toEqual(
      reachedForCi({
        keys,
        map: { recording: RECORDING, flows: opened },
        changed: { files: ["lib/letters.ts"], addedOrDeleted: [] },
        context: reachContext(root),
        seed: "another",
      })!.spot,
    );
    expect(reachedLine(chosen, keys.length)).toBe(
      "8 of 14 flows, from 1 changed files: 1 reached, 1 with no record on main, 6 spot checks.",
    );
  });

  it("runs only the spot checks and new flows for docs and set-up, and says which files it can't place", () => {
    const chosen = choose(["docs/testing.md", "package-lock.json", "postcss.config.mjs"])!;
    expect(chosen.run).toEqual(new Set(["desktop|staff|A new flow", ...chosen.spot]));
    expect(reachedLine(chosen, keys.length)).toBe(
      "7 of 14 flows, from 3 changed files: 0 reached, 1 with no record on main, 6 spot checks. What postcss.config.mjs can change isn't known.",
    );
  });

  it("runs every flow on both viewports for a file that reaches everything", () => {
    const chosen = choose(["proxy.ts"])!;
    expect(chosen.run).toEqual(new Set(keys));
    expect(reachedLine(chosen, keys.length)).toContain("every desktop flow, as proxy.ts changed");
  });

  it("runs every flow when main's flows were recorded another way", () => {
    expect(choose(["lib/letters.ts"], RECORDING + 1)!.run).toEqual(new Set(keys));
  });
});
