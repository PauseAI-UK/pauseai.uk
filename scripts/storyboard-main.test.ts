import { describe, expect, it } from "vitest";
import {
  carryable,
  carryFlows,
  flowKey,
  listedFlows,
  picturedFlows,
  runFolder,
  selectFlows,
} from "./storyboard-main.mjs";

const run = (flow: string, extra: Partial<{ viewport: string; png: string }> = {}) => ({
  section: "staff",
  flow,
  viewport: extra.viewport ?? "desktop",
  line: 1,
  status: "passed" as const,
  frames: [{ caption: "a", png: extra.png ?? `main-run/frames/${flow}/frame-1.png` }],
});

describe("listedFlows", () => {
  it("keys every test Playwright lists, in nested describes too, by viewport, section and title, with its test-list line", () => {
    const list = {
      suites: [
        {
          specs: [
            {
              title: "log in",
              file: "staff.spec.ts",
              tests: [{ projectName: "desktop" }, { projectName: "phone" }],
            },
          ],
          suites: [
            {
              title: "mobile nav",
              specs: [{ title: "a menu", file: "mobile-nav.spec.ts", tests: [{ projectName: "phone" }] }],
            },
          ],
        },
        {},
      ],
    };
    expect([...listedFlows(list)]).toEqual([
      ["desktop|staff|log in", "[desktop] › staff.spec.ts › log in"],
      ["phone|staff|log in", "[phone] › staff.spec.ts › log in"],
      ["phone|mobile-nav|a menu", "[phone] › mobile-nav.spec.ts › mobile nav › a menu"],
    ]);
    expect(listedFlows({}).size).toBe(0);
  });
});

describe("selectFlows", () => {
  it("keeps only the flows a run selected", () => {
    const manifest = { frames: [run("log in"), run("letters")] };
    expect(selectFlows(manifest, new Set([flowKey(run("letters"))])).frames).toEqual([run("letters")]);
  });
});

describe("carryFlows", () => {
  it("puts a partial run's flows on top of the last run's", () => {
    const previous = { frames: [run("log in", { png: "old.png" }), run("letters")] };
    const fresh = { frames: [run("log in", { png: "new.png" }), run("history")] };
    expect(carryFlows(previous, fresh).frames.map((r) => [r.flow, r.frames[0].png])).toEqual([
      ["letters", "main-run/frames/letters/frame-1.png"],
      ["log in", "new.png"],
      ["history", "main-run/frames/history/frame-1.png"],
    ]);
  });
});

describe("carryable", () => {
  const suite = new Set(["desktop|staff|log in", "desktop|staff|letters"]);

  it("drops flows the suite no longer has", () => {
    const manifest = { frames: [run("log in"), run("renamed"), run("letters", { viewport: "phone" })] };
    expect(carryable(manifest, suite).frames.map((r) => r.flow)).toEqual(["log in"]);
  });

  it("drops flows with pictures under a foreign folder, when given one", () => {
    const manifest = { frames: [run("log in"), run("letters", { png: "main/frames/letters/frame-1.png" })] };
    expect(carryable(manifest, suite, "main-run/").frames.map((r) => r.flow)).toEqual(["letters"]);
    expect(carryable(manifest, suite).frames.map((r) => r.flow)).toEqual(["log in", "letters"]);
  });

  it("keeps a flow that has no pictures", () => {
    const manifest = { frames: [{ ...run("log in"), frames: [{ caption: "a" }] }] };
    expect(carryable(manifest, suite, "main-run/").frames).toHaveLength(1);
  });
});

describe("runFolder", () => {
  it("names a run by when it started, sortably and with nothing a path minds", () => {
    expect(runFolder("2026-10-17T08:30:12.345Z")).toBe("2026-10-17T08-30-12");
  });
});

describe("picturedFlows", () => {
  it("keeps the flows a run wants that took a picture on this branch", () => {
    const branch = {
      frames: [
        run("log in"),
        { ...run("redirects"), frames: [] },
        { ...run("blank"), frames: [{ caption: "none" }] },
        run("not wanted"),
      ],
    };
    const wanted = ["log in", "redirects", "blank", "absent"].map((flow) => flowKey(run(flow)));
    expect([...picturedFlows(branch, wanted)]).toEqual([flowKey(run("log in"))]);
  });
});
