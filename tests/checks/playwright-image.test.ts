import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// CI's jobs with a browser run in Playwright's image, whose browsers are
// those of one version of Playwright: @playwright/test's, or its browsers
// aren't the ones it looks for. Dependabot bumps the package and not the
// image, so this fails until the image follows.

const ROOT = join(__dirname, "..", "..");
const read = (file: string) => readFileSync(join(ROOT, file), "utf8");

it("every CI job's Playwright image is @playwright/test's version", () => {
  const lock = JSON.parse(read("package-lock.json"));
  const version: string = lock.packages["node_modules/@playwright/test"].version;
  const images = new Set(read(".github/workflows/ci.yml").match(/mcr\.microsoft\.com\/playwright:\S+/g));
  expect([...images]).toEqual([`mcr.microsoft.com/playwright:v${version}-noble`]);
});
