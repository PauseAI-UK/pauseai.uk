import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { compare, samePixels } from "./storyboard-determinism.mjs";

const run = (flow: string, frames: { caption: string; png?: string }[], status = "passed") => ({
  section: "gallery",
  flow,
  viewport: "phone",
  status,
  frames,
});

describe("compare", () => {
  const same = async (a: string, b: string) => a.replace("plain", "") === b.replace("spaced", "");

  it("finds the frames whose pictures differ, and leaves out those that match or have none", async () => {
    const plain = {
      frames: [
        run("gallery: ui", [
          { caption: "Pill", png: "plain/pill.png" },
          { caption: "Button", png: "plain/button.png" },
          { caption: "Nothing to picture" },
        ]),
      ],
    };
    const spaced = {
      frames: [
        run("gallery: ui", [
          { caption: "Pill", png: "spaced/pill.png" },
          { caption: "Button", png: "spaced/button-moved.png" },
          { caption: "Nothing to picture" },
        ]),
      ],
    };
    expect(await compare(plain, spaced, same)).toEqual({
      differs: [
        {
          key: "phone|gallery|gallery: ui",
          caption: "Button",
          plain: "plain/button.png",
          spaced: "spaced/button-moved.png",
        },
      ],
      problems: [],
    });
  });

  it("counts a frame pictured in one pass and not the other as differing", async () => {
    const { differs } = await compare(
      { frames: [run("gallery: ui", [{ caption: "Pill", png: "plain/pill.png" }])] },
      { frames: [run("gallery: ui", [{ caption: "Pill" }])] },
      same,
    );
    expect(differs).toEqual([{ key: "phone|gallery|gallery: ui", caption: "Pill", plain: "plain/pill.png" }]);
  });

  it("names the flows it can't compare: failed, in one pass alone, or with other frames", async () => {
    const plain = {
      frames: [
        run("gallery: ui", [], "failed"),
        run("gallery: forms", [{ caption: "Field" }]),
        run("gallery: tokens", []),
      ],
    };
    const spaced = {
      frames: [run("gallery: ui", []), run("gallery: forms", [{ caption: "Select" }]), run("gallery: home", [])],
    };
    expect((await compare(plain, spaced, same)).problems).toEqual([
      { key: "phone|gallery|gallery: ui", problem: "failed plain, passed spaced" },
      { key: "phone|gallery|gallery: forms", problem: "other frames in the spaced pass" },
      { key: "phone|gallery|gallery: tokens", problem: "not in the spaced pass" },
      { key: "phone|gallery|gallery: home", problem: "not in the plain pass" },
    ]);
  });
});

describe("samePixels", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "determinism-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const png = async (name: string, width: number, red: number) => {
    const file = join(dir, name);
    await sharp({ create: { width, height: 2, channels: 4, background: { r: red, g: 0, b: 0, alpha: 1 } } })
      .png()
      .toFile(file);
    return file;
  };

  it("is true only for pictures of one size with every pixel the same", async () => {
    const a = await png("a.png", 2, 200);
    expect(await samePixels(a, await png("b.png", 2, 200))).toBe(true);
    expect(await samePixels(a, await png("c.png", 2, 201))).toBe(false);
    expect(await samePixels(a, await png("d.png", 3, 200))).toBe(false);
  });
});
