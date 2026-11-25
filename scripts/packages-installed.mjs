#!/usr/bin/env node
// Whether node_modules holds what package-lock.json says, run as one of the
// gate's fast checks. A pull or rebase that brings a new lockfile installs
// nothing, so the checkout goes on running the old versions while CI runs
// the new, and what fails looks like a flaky test. `npm ls` doesn't see it:
// it checks package.json's ranges, which the old version still meets.
//
// npm keeps what it installed in node_modules/.package-lock.json, so each
// package's version there is compared with the lockfile's.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The packages whose installed version isn't the lockfile's, from the two
 * files' `packages`, each as "path: installed, locked". A package the
 * lockfile has for another platform only is never installed, so it isn't
 * counted as missing.
 *
 * @param {Record<string, { version?: string, optional?: boolean }>} locked
 * @param {Record<string, { version?: string }>} installed
 * @returns {string[]}
 */
export function behind(locked, installed) {
  return Object.entries(locked)
    .filter(([path]) => path.startsWith("node_modules/"))
    .filter(([path, entry]) => installed[path]?.version !== entry.version && !(entry.optional && !installed[path]))
    .map(
      ([path, entry]) =>
        `${path.slice("node_modules/".length)}: ${installed[path]?.version ?? "none"}, locked ${entry.version}`,
    );
}

/** The same for the checkout at `root`. */
export function behindIn(root) {
  const read = (file) => JSON.parse(readFileSync(join(root, file), "utf8")).packages;
  const hidden = "node_modules/.package-lock.json";
  if (!existsSync(join(root, hidden))) return ["node_modules: none installed"];
  return behind(read("package-lock.json"), read(hidden));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const found = behindIn(process.cwd());
  if (found.length > 0) {
    console.error(`The installed packages aren't package-lock.json's. Run npm ci.\n${found.slice(0, 20).join("\n")}`);
    if (found.length > 20) console.error(`and ${found.length - 20} more`);
    process.exit(1);
  }
  console.log("The installed packages are package-lock.json's.");
}
