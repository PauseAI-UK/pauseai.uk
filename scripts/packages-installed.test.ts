import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { behind, behindIn } from "./packages-installed.mjs";

describe("behind", () => {
  it("finds a package installed at another version than the lockfile's, or not at all", () => {
    expect(
      behind(
        {
          "": {},
          "node_modules/vitest": { version: "5.1.0" },
          "node_modules/pg": { version: "8.23.1" },
          "node_modules/jszip": { version: "3.10.2" },
        },
        { "node_modules/vitest": { version: "5.0.5" }, "node_modules/pg": { version: "8.23.1" } },
      ),
    ).toEqual(["vitest: 5.0.5, locked 5.1.0", "jszip: none, locked 3.10.2"]);
  });

  it("leaves out an optional package not installed, as one for another platform", () => {
    expect(behind({ "node_modules/@esbuild/darwin-arm64": { version: "1.0.0", optional: true } }, {})).toEqual([]);
  });
});

describe("behindIn", () => {
  let root: string;
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  it("reads the checkout's lockfile and what npm installed, and says when nothing is", () => {
    root = mkdtempSync(join(tmpdir(), "packages-installed-"));
    const lock = { packages: { "node_modules/pg": { version: "8.23.1" } } };
    writeFileSync(join(root, "package-lock.json"), JSON.stringify(lock));
    expect(behindIn(root)).toEqual(["node_modules: none installed"]);
    mkdirSync(join(root, "node_modules"));
    writeFileSync(join(root, "node_modules/.package-lock.json"), JSON.stringify(lock));
    expect(behindIn(root)).toEqual([]);
  });
});
