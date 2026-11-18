import { describe, expect, it } from "vitest";
import type { TestSpecification, Vitest } from "vitest/node";
import { deal, flowsForPart, mergeVitestResults, TimedSequencer } from "./ci-parts.mjs";

const item = (key: string, ms: number | undefined, group = "g") => ({ key, group, ms });

describe("deal", () => {
  it("deals longest first, each to the part with the least so far, so the parts take about as long", () => {
    // 38, 21 and 16 go to different parts, and the short ones fill in.
    const parts = deal([item("a", 4), item("b", 38), item("c", 3), item("d", 21), item("e", 16), item("f", 4)], 3);
    expect(parts).toEqual([["b"], ["c", "d"], ["a", "e", "f"]]);
  });

  it("deals in turn when nothing has a time", () => {
    expect(deal([item("a", undefined), item("b", undefined), item("c", undefined), item("d", undefined)], 3)).toEqual([
      ["a", "d"],
      ["b"],
      ["c"],
    ]);
  });

  it("takes an item with no time to be as long as the middle one of its group, or of all", () => {
    // "new" is a gallery flow, so 30s like the other two, not the 2s of
    // most: each part gets one of the three.
    const gallery = [item("g1", 30_000, "gallery"), item("g2", 30_000, "gallery"), item("new", undefined, "gallery")];
    const rest = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => item(`r${n}`, 2_000, "rest"));
    const parts = deal([...gallery, ...rest], 3);
    expect(parts.map((part) => part.filter((key) => ["g1", "g2", "new"].includes(key)).length)).toEqual([1, 1, 1]);
    // In a group with no times, it's the middle of all: 10, so it's dealt as
    // long as "a", and "b" joins "a".
    expect(deal([item("a", 10), item("b", 4), item("c", undefined, "other")], 2)).toEqual([["a", "b"], ["c"]]);
  });

  it("deals the same parts whatever order the items come in", () => {
    const items = [item("a", 5), item("b", 5), item("c", 5), item("d", 5)];
    const sorted = (parts: string[][]) => parts.map((part) => [...part].sort());
    expect(sorted(deal([...items].reverse(), 2))).toEqual(sorted(deal(items, 2)));
  });
});

describe("TimedSequencer", () => {
  it("gives a shard the files dealt to it by Vitest's cached times", async () => {
    const durations: Record<string, number | undefined> = { slow: 60_000, a: 10_000, b: 10_000, c: undefined };
    const files = Object.keys(durations).map((moduleId) => ({ moduleId, project: { name: "node" } }));
    const ctx = (index: number) =>
      ({
        config: { shard: { index, count: 2 } },
        cache: { getTestSpecificationResult: (spec: { moduleId: string }) => ({ duration: durations[spec.moduleId] }) },
      }) as unknown as Vitest;
    const shard = async (index: number) =>
      (await new TimedSequencer(ctx(index)).shard(files as unknown as TestSpecification[])).map((s) => s.moduleId);
    expect(await shard(1)).toEqual(["slow"]);
    expect(await shard(2)).toEqual(["a", "b", "c"]);
  });
});

describe("mergeVitestResults", () => {
  it("keeps each file's record from the part that ran it last", () => {
    const old = { duration: 1, failed: false, lastRun: 100 };
    const merged = mergeVitestResults([
      { version: 1, projects: { node: { files: { "a.test.ts": { duration: 5, lastRun: 200 }, "b.test.ts": old } } } },
      { version: 1, projects: { node: { files: { "a.test.ts": old, "b.test.ts": { duration: 7, lastRun: 200 } } } } },
      { version: 1, projects: { browser: { files: { "c.test.ts": { duration: 9 } } }, empty: {} } },
    ]);
    expect(merged).toEqual({
      version: 1,
      projects: {
        node: { files: { "a.test.ts": { duration: 5, lastRun: 200 }, "b.test.ts": { duration: 7, lastRun: 200 } } },
        browser: { files: { "c.test.ts": { duration: 9 } } },
        empty: { files: {} },
      },
    });
  });
});

describe("flowsForPart", () => {
  it("gives a part's lines for --test-list, dealt by each flow's time, a new one as long as its section's middle", () => {
    const listed = new Map([
      ["desktop|gallery|gallery: staff-kit", "[desktop] › gallery.spec.ts › gallery: staff-kit"],
      ["desktop|gallery|gallery: new", "[desktop] › gallery.spec.ts › gallery: new"],
      ["desktop|audit-log|Ticking quickly", "[desktop] › audit-log.spec.ts › Ticking quickly"],
      ["desktop|audit-log|Leaving out every choice", "[desktop] › audit-log.spec.ts › Leaving out every choice"],
    ]);
    const times = {
      "desktop|gallery|gallery: staff-kit": 37_800,
      "desktop|audit-log|Ticking quickly": 4_900,
      "desktop|audit-log|Leaving out every choice": 2_900,
    };
    // The new gallery flow is taken as long as staff-kit, so they're apart.
    expect(flowsForPart(listed, times, 1, 2)).toEqual([
      "[desktop] › gallery.spec.ts › gallery: new",
      "[desktop] › audit-log.spec.ts › Ticking quickly",
    ]);
    expect(flowsForPart(listed, times, 2, 2)).toEqual([
      "[desktop] › gallery.spec.ts › gallery: staff-kit",
      "[desktop] › audit-log.spec.ts › Leaving out every choice",
    ]);
  });
});
