import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

// Netlify runs the server on AWS Lambda, whose Node starts with this flag,
// refusing require() of an ES module
// (https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html#nodejs-experimental-features).
// The bundle doesn't mind, but Next leaves some packages out of it, for
// Node to load with require(), so each of ours among them must load with
// the flag on (docs/code-structure.md, "Server code").
const LAMBDA_FLAG = "--no-experimental-require-module";

/** Our dependencies that Next leaves out of the server's bundle: those on its own list, and any next.config.ts adds. */
function unbundled(): string[] {
  const nextsOwn = readFileSync("node_modules/next/dist/lib/server-external-packages.jsonc", "utf8")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/,(\s*\])/, "$1");
  const added = /serverExternalPackages\s*:\s*\[([^\]]*)\]/.exec(readFileSync("next.config.ts", "utf8"))?.[1] ?? "";
  const external = new Set([
    ...(JSON.parse(nextsOwn) as string[]),
    ...[...added.matchAll(/["']([^"']+)["']/g)].map(([, name]) => name),
  ]);
  const { dependencies } = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> };
  return Object.keys(dependencies).filter((name) => external.has(name));
}

/** Its error's code if `module` fails to load with require() under Lambda's flag. */
function lambdaRefuses(module: string): string | undefined {
  try {
    execFileSync(process.execPath, [LAMBDA_FLAG, "-e", `require(${JSON.stringify(module)})`], { stdio: "pipe" });
    return undefined;
  } catch (error) {
    return /\b(ERR_[A-Z_]+)\b/.exec(String((error as { stderr: Buffer }).stderr))?.[1] ?? "failed";
  }
}

describe("loading on AWS Lambda", () => {
  it("every package Next leaves out of the bundle loads with require() under Lambda's flag", () => {
    const packages = unbundled();
    expect(packages).toContain("pg");
    expect(packages.map((name) => [name, lambdaRefuses(name)])).toEqual(packages.map((name) => [name, undefined]));
  });

  const dir = mkdtempSync(join(tmpdir(), "lambda-require-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("would spot one that loads an ES module", () => {
    const esm = join(dir, "esm.mjs");
    writeFileSync(esm, "export const x = 1;\n");
    expect(lambdaRefuses(esm)).toBe("ERR_REQUIRE_ESM");
  });
});
