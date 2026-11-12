import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  flowFolder,
  keepRuns,
  linkFlows,
  missingFlows,
  pruneStore,
  readTree,
  storeDir,
  touchTree,
} from "./storyboard-store.mjs";

let dir: string;
let store: string;
let runDir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "storyboard-store-"));
  store = storeDir(dir);
  runDir = join(dir, "run");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** A flow of a run, its one frame's picture written to the run's folder with `contents`. */
function run(flow: string, contents?: string, extra: Partial<{ status: "passed" | "failed"; viewport: string }> = {}) {
  const png = `branch/frames/${flow}/frame-1.png`;
  if (contents !== undefined) {
    mkdirSync(dirname(join(runDir, png)), { recursive: true });
    writeFileSync(join(runDir, png), contents);
  }
  return {
    section: "staff",
    flow,
    viewport: extra.viewport ?? "desktop",
    line: 1,
    status: extra.status ?? ("passed" as const),
    frames: [contents === undefined ? { caption: "a" } : { caption: "a", png }],
  };
}

const key = (flow: string) => `desktop|staff|${flow}`;

describe("storeDir and flowFolder", () => {
  it("puts the store in the main checkout's test-results", () => {
    expect(storeDir("/home/jane/pauseai.uk")).toBe("/home/jane/pauseai.uk/test-results/storyboard-frames");
  });

  it("names a flow's folder as the reporter does", () => {
    expect(flowFolder({ section: "staff-login", viewport: "phone", flow: "Log in (again)" })).toBe(
      "staff-login-phone-Log-in-again-",
    );
  });
});

describe("keepRuns and readTree", () => {
  it("has nothing of a tree no run has kept", () => {
    expect(readTree(store, "t1")).toEqual({ frames: [] });
  });

  it("keeps each flow with its pictures by their contents, and the tree's suite", () => {
    const kept = keepRuns(store, "t1", runDir, [run("log in", "one"), run("letters", "one"), run("blank")], {
      [key("log in")]: "[desktop] › staff.spec.ts › log in",
    });
    expect(kept.flows).toEqual({ [key("log in")]: "[desktop] › staff.spec.ts › log in" });
    const [logIn, letters, blank] = kept.frames;
    expect(logIn.frames[0].picture).toMatch(/^[0-9a-f]{64}$/);
    expect(letters.frames[0].picture).toBe(logIn.frames[0].picture);
    expect(logIn.frames[0]).not.toHaveProperty("png");
    expect(blank.frames).toEqual([{ caption: "a" }]);
    expect(readTree(store, "t1")).toEqual(kept);
    expect(readTree(store, "t2")).toEqual({ frames: [] });
  });

  it("keeps a tree apart on each platform", () => {
    keepRuns(store, "t1", runDir, [run("log in", "one")], undefined, "linux");
    expect(readTree(store, "t1", "linux").frames).toHaveLength(1);
    expect(readTree(store, "t1", "darwin").frames).toHaveLength(0);
  });

  it("adds a later run's flows, replacing their namesakes, and keeps the suite it had", () => {
    keepRuns(store, "t1", runDir, [run("log in", "one", { status: "failed" }), run("letters", "two")], { a: "b" });
    const kept = keepRuns(store, "t1", runDir, [run("log in", "three"), run("history", "four")]);
    expect(kept.flows).toEqual({ a: "b" });
    expect(kept.frames.map((r) => [r.flow, r.status])).toEqual([
      ["letters", "passed"],
      ["log in", "passed"],
      ["history", "passed"],
    ]);
  });

  it("never replaces a flow that passed with a run of it that didn't", () => {
    const first = keepRuns(store, "t1", runDir, [run("log in", "one")]);
    const kept = keepRuns(store, "t1", runDir, [run("log in", "two", { status: "failed" })]);
    expect(kept).toEqual(first);
    // A pass replaces a pass: --fresh-main's run.
    const again = keepRuns(store, "t1", runDir, [run("log in", "three")]);
    expect(again.frames[0].frames[0].picture).not.toBe(first.frames[0].frames[0].picture);
  });

  it("leaves out a flow that was interrupted", () => {
    const interrupted = { ...run("log in", "one"), status: "interrupted" as const };
    expect(keepRuns(store, "t1", runDir, [interrupted]).frames).toEqual([]);
  });
});

describe("missingFlows", () => {
  it("finds the flows that haven't run, or didn't pass", () => {
    const kept = keepRuns(store, "t1", runDir, [run("log in", "one"), run("letters", "two", { status: "failed" })]);
    expect(missingFlows(store, kept, [key("log in"), key("letters"), key("history")])).toEqual([
      key("letters"),
      key("history"),
    ]);
  });

  it("finds a flow whose picture has gone from the store", () => {
    const kept = keepRuns(store, "t1", runDir, [run("log in", "one"), run("blank")]);
    rmSync(join(store, "pictures"), { recursive: true });
    expect(missingFlows(store, kept, [key("log in"), key("blank")])).toEqual([key("log in")]);
  });
});

describe("linkFlows", () => {
  it("gives the flows wanted as a run's manifest, their pictures in the run's folder", () => {
    const kept = keepRuns(store, "t1", runDir, [run("log in", "one"), run("letters", "two"), run("blank")]);
    const review = join(dir, "review");
    const linked = linkFlows(store, kept, new Set([key("log in"), key("blank")]), review);
    expect(linked.frames.map((r) => r.frames[0])).toEqual([
      { caption: "a", png: "main/frames/staff-desktop-log-in/frame-1.png" },
      { caption: "a" },
    ]);
    expect(readFileSync(join(review, "main/frames/staff-desktop-log-in/frame-1.png"), "utf8")).toBe("one");
  });

  it("replaces a picture already there, without writing into it", () => {
    const kept = keepRuns(store, "t1", runDir, [run("log in", "one")]);
    const review = join(dir, "review");
    const old = join(dir, "old.png");
    const target = join(review, "side/frames/staff-desktop-log-in/frame-1.png");
    writeFileSync(old, "old");
    mkdirSync(dirname(target), { recursive: true });
    linkSync(old, target);
    linkFlows(store, kept, new Set([key("log in")]), review, "side");
    expect(readFileSync(target, "utf8")).toBe("one");
    expect(readFileSync(old, "utf8")).toBe("old");
  });

  it("leaves out a flow whose picture has gone from the store", () => {
    const kept = keepRuns(store, "t1", runDir, [run("log in", "one")]);
    rmSync(join(store, "pictures"), { recursive: true });
    expect(linkFlows(store, kept, new Set([key("log in")]), join(dir, "review")).frames).toEqual([]);
  });
});

describe("pruneStore and touchTree", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const picture = (hash: string) => join(store, "pictures", hash.slice(0, 2), `${hash}.png`);
  const treeFile = (tree: string) => join(store, "trees", `${process.platform}-${tree}.json`);
  const age = (file: string, ms: number) => utimesSync(file, new Date(Date.now() - ms), new Date(Date.now() - ms));

  it("does nothing to a store that isn't there, or has no pictures", () => {
    pruneStore(store, 1);
    keepRuns(store, "t1", runDir, [run("blank")]);
    pruneStore(store, 1);
    expect(readTree(store, "t1").frames).toHaveLength(1);
  });

  it("keeps the trees used most recently, and drops old pictures that no tree left refers to", () => {
    const [one] = keepRuns(store, "old", runDir, [run("log in", "one")]).frames;
    const [two] = keepRuns(store, "new", runDir, [run("log in", "two")]).frames;
    const [three] = keepRuns(store, "old", runDir, [run("letters", "three")]).frames.slice(-1);
    age(treeFile("old"), 3 * DAY);
    for (const kept of [one, two]) age(picture(kept.frames[0].picture!), 2 * DAY);
    pruneStore(store, 1);
    expect(existsSync(treeFile("old"))).toBe(false);
    expect(existsSync(treeFile("new"))).toBe(true);
    // Old and unreferenced goes; referenced stays; new and unreferenced stays, as it may be on its way in.
    expect(existsSync(picture(one.frames[0].picture!))).toBe(false);
    expect(existsSync(picture(two.frames[0].picture!))).toBe(true);
    expect(existsSync(picture(three.frames[0].picture!))).toBe(true);
  });

  it("counts a tree as used when it's touched", () => {
    keepRuns(store, "old", runDir, [run("log in", "one")]);
    keepRuns(store, "new", runDir, [run("log in", "two")]);
    age(treeFile("old"), 3 * DAY);
    touchTree(store, "old", new Date(Date.now() + DAY));
    touchTree(store, "absent");
    expect(statSync(treeFile("old")).mtimeMs).toBeGreaterThan(statSync(treeFile("new")).mtimeMs);
    pruneStore(store, 1);
    expect(existsSync(treeFile("old"))).toBe(true);
    expect(existsSync(treeFile("new"))).toBe(false);
  });
});
