import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

// CI's jobs with a browser run in CI's own image, tagged with its
// Dockerfile's hash by .github/workflows/ci-image.yml. So a change to the
// Dockerfile changes the tag ci.yml must name, and this fails until it does.

const ROOT = join(__dirname, "..", "..");
const read = (file: string) => readFileSync(join(ROOT, file));

it("every CI job's image is the one its Dockerfile makes", () => {
  const hash = createHash("sha256").update(read(".github/ci-image/Dockerfile")).digest("hex").slice(0, 12);
  const images = new Set(
    read(".github/workflows/ci.yml")
      .toString()
      .match(/ghcr\.io\/pauseai-uk\/ci:\S+/g),
  );
  expect([...images]).toEqual([`ghcr.io/pauseai-uk/ci:${hash}`]);
});
