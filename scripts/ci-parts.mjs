#!/usr/bin/env node
// Deals CI's storyboard flows into parts (.github/workflows/ci.yml), each
// part working out the same deal and running its own. Dealt in turn by key,
// not in blocks of a file as Playwright's `--shard` does, which put the
// gallery's slow flows in one part.
//
// On a pull request, the parts deal only the flows its change can reach
// (reachedForCi), by what each flow opened when main's CI last ran it:
// main's commit's record, which main's CI keeps in the Actions cache
// (tests/storyboard/report/opened.ts). Every part restores the record by
// main's commit alone, never the newest, so they all choose the same flows.
//
//   node scripts/ci-parts.mjs storyboard <part>/<count> <test-list> [<opened.json> <main's commit>]
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { listedFlows } from "./storyboard-main.mjs";
import { flowsReached, reachContext, spotCheckKeys } from "./storyboard-reach.mjs";

/**
 * The lines for `playwright test --test-list` of `part` (from 1) of `count`,
 * from `listed` (listedFlows): the flows by key, dealt in turn, so a
 * section's flows, the gallery's slow ones too, are spread between the parts.
 */
export function flowsForPart(listed, part, count) {
  return [...listed.keys()]
    .sort()
    .filter((_, at) => at % count === part - 1)
    .map((key) => listed.get(key));
}

/**
 * Of `keys`, the flows CI runs on a pull request: those its change can reach
 * (`changed`, the files changed from main's commit, and those of them added
 * or deleted), by what each flow opened when main's CI last ran it (`map`:
 * the recording, and each flow's `opened`, by key); those `map` has no
 * record of, as new flows; and the spot checks, chosen by `seed`, main's
 * commit. Undefined, for every flow, with no map. `reached` is
 * flowsReached's, to say why.
 */
export function reachedForCi({ keys, map, changed, context, seed }) {
  if (!map) return undefined;
  const records = Object.entries(map.flows).map(([key, opened]) => {
    const [viewport, section, ...flow] = key.split("|");
    return { key, viewport, section, flow: flow.join("|"), status: "passed", opened, recording: map.recording };
  });
  const reached = flowsReached({
    suite: new Set(keys),
    records,
    phoneTagged: new Set(keys.filter((key) => key.startsWith("phone|"))),
    context,
    changed,
  });
  const spot = spotCheckKeys(
    keys.filter((key) => !reached.run.has(key)),
    seed,
  );
  return { run: new Set([...reached.run, ...spot]), reached, spot };
}

/** What `reachedForCi` chose, in a line for the log, and the files it couldn't place. */
export function reachedLine({ run, reached, spot }, total) {
  const parts = [
    `${reached.reached} reached`,
    reached.swept && `every desktop flow, as ${reached.everything.join(", ")} changed`,
    reached.fresh && `${reached.fresh} with no record on main`,
    `${spot.length} spot checks`,
  ].filter(Boolean);
  const unknown = reached.unknown.length ? ` What ${reached.unknown.join(", ")} can change isn't known.` : "";
  return `${run.size} of ${total} flows, from ${reached.changed.length} changed files: ${parts.join(", ")}.${unknown}`;
}

/** The files changed from `base` to the commit checked out, and those of them added or deleted. */
function changedSince(base) {
  const lines = spawnSync("git", ["diff", "--name-status", "--no-renames", base, "HEAD"], { encoding: "utf8" });
  if (lines.status !== 0) throw new Error(`Couldn't tell what changed from ${base}:\n${lines.stderr}`);
  const status = lines.stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
  return {
    files: status.map(([, file]) => file),
    addedOrDeleted: status.filter(([how]) => how === "A" || how === "D").map(([, file]) => file),
  };
}

/** A JSON file's content, or undefined when it can't be read. */
function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [command, which, out, openedFile, base] = process.argv.slice(2);
  if (command !== "storyboard") throw new Error(`Unknown command ${command}: storyboard.`);
  const [part, count] = which.split("/").map(Number);
  const listing = spawnSync("npx", ["playwright", "test", "--list", "--reporter=json"], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (listing.status !== 0) throw new Error(`Couldn't list the flows:\n${listing.stderr}`);
  const listed = listedFlows(JSON.parse(listing.stdout));
  const map = openedFile && readJson(openedFile);
  const chosen =
    map &&
    reachedForCi({
      keys: [...listed.keys()],
      map,
      changed: changedSince(base),
      context: reachContext(process.cwd()),
      seed: base,
    });
  if (chosen) console.log(`Storyboard: ${reachedLine(chosen, listed.size)}`);
  else if (openedFile) console.log(`Storyboard: every flow, as main's CI kept no record for ${base}.`);
  const flows = chosen ? new Map([...listed].filter(([key]) => chosen.run.has(key))) : listed;
  const lines = flowsForPart(flows, part, count);
  writeFileSync(out, lines.join("\n"));
  console.log(`Part ${part} of ${count}: ${lines.length} flows.`);
}
