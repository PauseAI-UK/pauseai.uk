import { describe, expect, it } from "vitest";
import { importGraph } from "@/scripts/storyboard-reach.mjs";

// No import cycles. Modules that import each other, however far round,
// can't be understood, tested or moved apart, and a change to any of them
// reaches everything any of them reaches. Type-only imports don't count, as
// they're gone once compiled; nor does code handed over to a module as
// another loads (HANDED_OVER in scripts/storyboard-reach.mjs), as nothing
// imports it. A cycle is broken by moving what the lower module needs from
// the higher one down, or passing it in (docs/code-structure.md).

type Graph = Map<string, string[]>;

/**
 * Each cycle in `graph`, told in words: a strongly connected component of
 * more than one file, by Tarjan's algorithm, or a file that imports itself.
 * Each is told as a path round it, from its first file in alphabetical
 * order back to it, then the component's other files, which a longer way
 * round goes through.
 */
function cycles(graph: Graph): string[] {
  let next = 0;
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  const visit = (file: string) => {
    index.set(file, next);
    low.set(file, next++);
    stack.push(file);
    onStack.add(file);
    for (const to of graph.get(file) ?? []) {
      if (!graph.has(to)) continue;
      if (!index.has(to)) {
        visit(to);
        low.set(file, Math.min(low.get(file)!, low.get(to)!));
      } else if (onStack.has(to)) low.set(file, Math.min(low.get(file)!, index.get(to)!));
    }
    if (low.get(file) !== index.get(file)) return;
    const component: string[] = [];
    let popped: string;
    do {
      popped = stack.pop()!;
      onStack.delete(popped);
      component.push(popped);
    } while (popped !== file);
    if (component.length > 1 || graph.get(file)!.includes(file)) components.push(component);
  };
  for (const file of [...graph.keys()].sort()) if (!index.has(file)) visit(file);
  return components
    .map((component) => {
      const path = pathRound(graph, new Set(component));
      const others = component.filter((file) => !path.includes(file)).sort();
      return `${path.join(" → ")}${others.length ? `, and through ${others.join(", ")}` : ""}`;
    })
    .sort();
}

/** A shortest path round `component` through `graph`'s imports, from its first file back to it. */
function pathRound(graph: Graph, component: Set<string>): string[] {
  const start = [...component].sort()[0];
  const cameFrom = new Map<string, string>();
  const queue = [start];
  for (const file of queue) {
    for (const to of (graph.get(file) ?? []).filter((each) => component.has(each)).sort()) {
      if (to === start) {
        const path = [file];
        while (path[0] !== start) path.unshift(cameFrom.get(path[0])!);
        return [...path, start];
      }
      if (!cameFrom.has(to)) {
        cameFrom.set(to, file);
        queue.push(to);
      }
    }
  }
  return [start];
}

describe("import cycles", { timeout: 120_000 }, () => {
  it("no module imports itself, however far round", () => {
    expect(cycles(importGraph(process.cwd(), { handedOver: false }))).toEqual([]);
  });

  it("would name each file of a cycle, in order, from the first back to it, and any other way round", () => {
    const graph: Graph = new Map([
      ["a.ts", ["b.ts", "node:fs"]],
      ["b.ts", ["c.ts"]],
      ["c.ts", ["a.ts", "d.ts"]],
      ["d.ts", []],
      ["e.ts", ["f.ts"]],
      ["f.ts", ["e.ts", "f.ts"]],
      ["g.ts", ["g.ts"]],
      ["h.ts", ["i.ts", "j.ts"]],
      ["i.ts", ["h.ts"]],
      ["j.ts", ["h.ts"]],
    ]);
    expect(cycles(graph)).toEqual([
      "a.ts → b.ts → c.ts → a.ts",
      "e.ts → f.ts → e.ts",
      "g.ts → g.ts",
      "h.ts → i.ts → h.ts, and through j.ts",
    ]);
  });

  it("passes a graph whose imports all lead down", () => {
    const graph: Graph = new Map([
      ["a.ts", ["b.ts", "c.ts"]],
      ["b.ts", ["c.ts"]],
      ["c.ts", []],
    ]);
    expect(cycles(graph)).toEqual([]);
  });
});
