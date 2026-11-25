#!/usr/bin/env node
// This checkout's fixture server (scripts/serve-fixture.mjs), which Playwright reuses whatever it was built
// from: one built from the code as it was before a change would be tested in the code's place. Its responses
// name the checkout and the tree it was built from (next.config.ts), so a run can tell, and stops one of its own
// checkout built from another tree, for Playwright to build afresh. Another checkout's server it leaves alone,
// for tests/storyboard/global-setup.ts to refuse.
//
//   node scripts/fixture-server.mjs   # stops this checkout's server if it's out of date (npm run test:storyboard)
//
// scripts/storyboard.mjs does the same before a review, and tells from it whether the build is the code's.
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  utimesSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHECKOUT_HEADER, TREE_HEADER } from "../lib/server/fixtures/fixture-env.mjs";
import { CHECKOUT_DIR, OWN_URL } from "../tests/checkout.mjs";

/**
 * The hash of the checkout's tree as it is now, with what's uncommitted and untracked: what a build of it
 * serves, and what a run of the suite here pictures.
 */
export function workingTree(cwd = process.cwd()) {
  const dir = mkdtempSync(join(tmpdir(), "pauseai-storyboard-index-"));
  try {
    const env = { ...process.env, GIT_INDEX_FILE: join(dir, "index") };
    // From the checkout's own index, so git reads only the files that have changed. The copy keeps the index's
    // time: Git doesn't trust an entry whose file changed in the second the index was written, and with the
    // copy's own time, later, it would, missing a same-size edit where it compares only whole seconds.
    const index = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-path", "index"], {
      cwd,
      encoding: "utf8",
    }).trim();
    copyFileSync(index, env.GIT_INDEX_FILE);
    const { atime, mtime } = statSync(index);
    utimesSync(env.GIT_INDEX_FILE, atime, mtime);
    execFileSync("git", ["add", "--all"], { cwd, env });
    return execFileSync("git", ["write-tree"], { cwd, env, encoding: "utf8" }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * What a server is, from its response's `headers` (null if nothing answered): `none` if nothing answered,
 * `foreign` if it isn't a fixture build of the checkout `dir`, `current` if it is one of the tree
 * `tree`, and `stale` if it's one of another tree, or one that names none.
 *
 * @param {{ get(name: string): string | null } | null} headers
 * @returns {"none" | "foreign" | "current" | "stale"}
 */
export function serverState(headers, dir, tree) {
  if (!headers) return "none";
  if (headers.get(CHECKOUT_HEADER) !== dir) return "foreign";
  return headers.get(TREE_HEADER) === tree ? "current" : "stale";
}

/** The headers of the server at `url`, or null if nothing answers there. */
async function headersAt(url) {
  try {
    return (await fetch(url, { method: "HEAD", redirect: "manual" })).headers;
  } catch {
    return null;
  }
}

/**
 * The IDs of the processes listening on `port`, from Linux's /proc (`proc`): the sockets listening there, from
 * its TCP tables, then the processes holding one open. Empty where there's no /proc, as on a Mac, or none is.
 */
export function listenerPids(port, proc = "/proc") {
  const sockets = new Set();
  for (const table of ["tcp", "tcp6"]) {
    let text;
    try {
      text = readFileSync(join(proc, "net", table), "utf8");
    } catch {
      continue;
    }
    for (const line of text.split("\n").slice(1)) {
      const fields = line.trim().split(/\s+/);
      // The local address, as hex address:port; the state, 0A for listening; the socket's inode.
      if (fields.length < 10 || fields[3] !== "0A") continue;
      if (parseInt(fields[1].split(":").at(-1), 16) === Number(port)) sockets.add(fields[9]);
    }
  }
  if (sockets.size === 0) return [];
  const pids = [];
  for (const pid of readdirSync(proc).filter((name) => /^\d+$/.test(name))) {
    let fds;
    try {
      fds = readdirSync(join(proc, pid, "fd"));
    } catch {
      // Another user's, or gone since.
      continue;
    }
    const holds = fds.some((fd) => {
      try {
        return sockets.has(/^socket:\[(\d+)\]$/.exec(readlinkSync(join(proc, pid, "fd", fd)))?.[1]);
      } catch {
        return false;
      }
    });
    if (holds) pids.push(Number(pid));
  }
  return pids;
}

const pause = (ms) => new Promise((done) => setTimeout(done, ms));

/**
 * Stops the server at `url` if it's the checkout `dir`'s, built from a tree other than `tree`, and waits until
 * nothing answers there. Returns what the server was (serverState), before any was stopped.
 */
export async function stopStaleServer({
  url = OWN_URL,
  dir = CHECKOUT_DIR,
  tree = workingTree(),
  headers = headersAt,
  pids = listenerPids,
  kill = process.kill,
  wait = pause,
  log = console.log,
} = {}) {
  const state = serverState(await headers(url), dir, tree);
  if (state !== "stale") return state;
  const port = new URL(url).port;
  const found = pids(port);
  if (found.length === 0)
    throw new Error(
      `${url} is serving a build of this checkout from before its last change, and this can't find its process to stop it. Stop it and run again.`,
    );
  log(`▶ ${url} is serving a build of this checkout from before its last change. Stopping it (${found.join(", ")}).`);
  for (const [signal, tries] of [
    ["SIGTERM", 50],
    ["SIGKILL", 25],
  ]) {
    for (const pid of found) {
      try {
        kill(pid, signal);
      } catch {
        // Gone already.
      }
    }
    for (let i = 0; i < tries; i++) {
      if (!(await headers(url))) return state;
      await wait(200);
    }
  }
  throw new Error(`${url} still answers after its server was killed. Stop it and run again.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  stopStaleServer().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
