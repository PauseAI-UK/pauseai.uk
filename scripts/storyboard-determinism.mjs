#!/usr/bin/env node
// Whether a frame depends on anything but what it shows (docs/testing.md,
// "The component gallery"): pictures every gallery
// group twice, on both viewports, the second time with SPACER pixels put
// above its first component (gallery.spec.ts, STORYBOARD_SPACER), and fails
// if any frame differs by a single pixel. A component is pictured alone
// (alone, tests/storyboard/frame.ts), so where the page draws it mustn't
// change its picture: a fraction of a pixel, or a few whole ones, above it.
//
//   npm run storyboard:determinism                        # every gallery group
//   npm run storyboard:determinism -- -g 'gallery: ui$'   # anything else goes to `playwright test`
//
// On the server already up on this checkout's port, as the review takes it,
// or else on one it builds and stops when it's done. The pictures are in
// test-results/storyboard-determinism/, a folder for each pass.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { LOCAL_URL } from "../tests/checkout.mjs";
import { flowKey } from "./storyboard-main.mjs";

/** The space put above the first component: a sliver of a pixel and a few whole ones. */
export const SPACER = 3.37;

const DIR = "test-results/storyboard-determinism";

/**
 * The frames of `spaced` that differ from `plain`'s (frames.json of each
 * pass, tests/storyboard/report/reporter.ts), as `{ key, caption, plain,
 * spaced }` with the pictures' paths, `same` saying whether two pictures
 * are the same; and the flows that failed, or that one pass has and the
 * other hasn't, or with other frames, as `{ key, problem }`.
 *
 * @param {{ frames: { section: string; flow: string; viewport: string; status: string; frames: { caption: string; png?: string }[] }[] }} plain
 * @param {typeof plain} spaced
 * @param {(a: string, b: string) => Promise<boolean>} same
 */
export async function compare(plain, spaced, same) {
  const differs = [];
  const problems = [];
  const spacedRuns = new Map(spaced.frames.map((run) => [flowKey(run), run]));
  for (const run of plain.frames) {
    const key = flowKey(run);
    const other = spacedRuns.get(key);
    spacedRuns.delete(key);
    if (!other) problems.push({ key, problem: "not in the spaced pass" });
    else if (run.status !== "passed" || other.status !== "passed")
      problems.push({ key, problem: `${run.status} plain, ${other.status} spaced` });
    else if (run.frames.map((f) => f.caption).join("\n") !== other.frames.map((f) => f.caption).join("\n"))
      problems.push({ key, problem: "other frames in the spaced pass" });
    else {
      for (const [at, frame] of run.frames.entries()) {
        const a = frame.png;
        const b = other.frames[at].png;
        if (a && b && (await same(a, b))) continue;
        if (!a && !b) continue;
        differs.push({ key, caption: frame.caption, plain: a, spaced: b });
      }
    }
  }
  for (const key of spacedRuns.keys()) problems.push({ key, problem: "not in the plain pass" });
  return { differs, problems };
}

/** Whether two PNGs have the same pixels, every one. */
export async function samePixels(a, b) {
  const [x, y] = await Promise.all(
    [a, b].map((file) => sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })),
  );
  return x.info.width === y.info.width && x.info.height === y.info.height && x.data.equals(y.data);
}

/** Whether a server answers at `url`. */
async function answers(url) {
  try {
    await fetch(url, { method: "HEAD", redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

/** A server on this checkout's port (scripts/serve-fixture.mjs), once it answers, or undefined if one already did. */
async function startServer() {
  if (await answers(LOCAL_URL)) {
    console.log(`On the server already up at ${LOCAL_URL}: stop it first if it's from before your last change.`);
    return undefined;
  }
  console.log(`Building and serving this checkout at ${LOCAL_URL}…`);
  const server = spawn("node", ["scripts/serve-fixture.mjs"], {
    stdio: ["ignore", "inherit", "inherit"],
    detached: true,
  });
  const exited = new Promise((done) => server.on("exit", (code) => done(code)));
  for (let waited = 0; ; waited += 2) {
    if (await answers(LOCAL_URL)) return server;
    const code = await Promise.race([exited, new Promise((done) => setTimeout(() => done(undefined), 2000))]);
    if (code !== undefined) throw new Error(`The server stopped (${code}) before it answered.`);
    if (waited > 600) throw new Error("The server didn't answer within ten minutes.");
  }
}

/** Runs the gallery section, with pictures, into DIR/<side>. Returns the exit code. */
function pass(side, extraEnv, args) {
  console.log(`\n▶ ${side}\n`);
  const result = spawnSync(
    "npx",
    ["playwright", "test", "gallery", `--output=test-results/playwright-determinism-${side}`, ...args],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        LOCAL_URL,
        STORYBOARD_SHOTS: "1",
        STORYBOARD_DIR: DIR,
        STORYBOARD_SIDE: side,
        STORYBOARD_RUN_AT: new Date().toISOString(),
        ...extraEnv,
      },
    },
  );
  return result.status ?? 1;
}

async function main(args) {
  rmSync(DIR, { recursive: true, force: true });
  const server = await startServer();
  // The whole group, serve-fixture.mjs and the `next start` it runs, however this script ends.
  const stop = () => server && process.kill(-server.pid, "SIGTERM");
  process.on("exit", stop);
  try {
    pass("plain", {}, args);
    pass("spaced", { STORYBOARD_SPACER: String(SPACER) }, args);
  } finally {
    stop();
    process.off("exit", stop);
  }
  const read = (side) => JSON.parse(readFileSync(join(DIR, side, "frames.json"), "utf8"));
  const { differs, problems } = await compare(read("plain"), read("spaced"), (a, b) =>
    samePixels(join(DIR, a), join(DIR, b)),
  );
  const frames = read("plain").frames.reduce((sum, run) => sum + run.frames.length, 0);
  for (const { key, problem } of problems) console.log(`✗ ${key}: ${problem}`);
  for (const { key, caption, plain, spaced } of differs) {
    console.log(
      `✗ ${key}, "${caption}" differs with ${SPACER}px above:\n    ${join(DIR, plain)}\n    ${join(DIR, spaced)}`,
    );
  }
  const ok = differs.length === 0 && problems.length === 0;
  console.log(
    ok
      ? `\n${frames} frames, each the same with ${SPACER}px above.`
      : `\n${differs.length} of ${frames} frames differ with ${SPACER}px above, and ${problems.length} flows couldn't be compared.`,
  );
  return ok ? 0 : 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.exit(130));
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(2);
    },
  );
}
