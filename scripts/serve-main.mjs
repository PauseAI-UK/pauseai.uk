#!/usr/bin/env node
// Builds and serves another version of the site on fixture data, for this
// branch's suite to drive: the storyboard review's `--this-suite-on-main`
// (scripts/storyboard.mjs). By default main as a pull request sees it, where
// this branch started from (the merge base of origin/main and HEAD).
// Nothing is fetched. Local only.
//
//   node scripts/serve-main.mjs [--ref <commit>] [--port <port>]
//
// It checks that commit out in main's checkout (scripts/main-checkout.mjs),
// gives it a fresh database if that version has one, builds it with the
// same fixture settings as this branch's test build, and serves it until
// stopped, by default on this checkout's port for main (MAIN_URL,
// tests/checkout.mjs).
import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { MAIN_DATABASE, MAIN_OUTBOX_DIR, MAIN_URL, MAIN_WORKTREE } from "../tests/checkout.mjs";
import { fixtureEnv } from "../lib/server/fixtures/fixture-env.mjs";
import { testServerUrl } from "./fresh-database.mjs";
import { checkOutMain } from "./main-checkout.mjs";

function option(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : process.argv[at + 1];
}

const port = option("port", new URL(MAIN_URL).port);
const run = (command, args, options = {}) => execFileSync(command, args, { stdio: "inherit", ...options });
const ref =
  option("ref", undefined) ?? execFileSync("git", ["merge-base", "origin/main", "HEAD"], { encoding: "utf8" }).trim();
const dir = MAIN_WORKTREE;

checkOutMain(ref, dir);

const env = { ...process.env, ...fixtureEnv({ outboxDir: MAIN_OUTBOX_DIR, origin: `http://localhost:${port}` }) };
// The same test Postgres as this branch's (`db-test`, say), which the
// worktree's own copy of the database script can't find in our .env.local.
const testServer = testServerUrl();
if (testServer) env.TEST_DATABASE_URL = testServer;
// A fresh database, if this version of the site has one.
const freshDatabase = join(dir, "scripts", "fresh-database.mjs");
if (existsSync(freshDatabase)) {
  env.NETLIFY_DB_URL = execFileSync("node", [freshDatabase, MAIN_DATABASE, "--test-mp", env.TEST_MP_EMAIL], {
    cwd: dir,
    encoding: "utf8",
  }).trim();
}

// next build directly, not npm run build, which runs the unit tests first.
run("npx", ["next", "build"], { cwd: dir, env });
// In its own process group, so stopping this script stops the server too:
// a signal to `next` alone leaves the server it starts running on the port,
// and the next review's run of main then hits a stale build.
const server = spawn(join(dir, "node_modules", ".bin", "next"), ["start", "--port", port], {
  cwd: dir,
  env,
  stdio: "inherit",
  detached: true,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => process.kill(-server.pid, signal));
server.on("exit", (code) => process.exit(code ?? 0));
