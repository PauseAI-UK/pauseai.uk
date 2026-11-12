#!/usr/bin/env node
// Builds this checkout on fixture data and serves it, for the storyboard:
// Playwright's webServer runs it (playwright.config.ts), and so can you, to
// keep one server up between runs (docs/development.md).
//
//   node scripts/serve-fixture.mjs [--port <port>]
//
// By default on this checkout's own port (OWN_URL, tests/checkout.mjs). Every
// response names the checkout it was built from (FIXTURE_CHECKOUT,
// next.config.ts), so the storyboard can refuse another checkout's server.
// The build gets a fresh database of its own, with the test MPs, for
// requests that carry no flow's cookie (tests/storyboard/fixtures.ts). Never
// the real one. `next build` directly, as scripts/serve-main.mjs builds main:
// `npm run build` runs the unit tests and the linters first, which CI's
// other job and the pre-commit hook already do.
import { execFileSync, spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { CHECKOUT_DIR, OUTBOX_DIR, OWN_URL, REQUESTS_DIR, SERVER_DATABASE } from "../tests/checkout.mjs";
import { fixtureEnv, TEST_MP_EMAIL } from "../lib/server/fixtures/fixture-env.mjs";

const at = process.argv.indexOf("--port");
const port = at === -1 ? new URL(OWN_URL).port : process.argv[at + 1];

const env = {
  ...process.env,
  ...fixtureEnv({ outboxDir: OUTBOX_DIR, origin: `http://localhost:${port}` }),
  FIXTURE_CHECKOUT: CHECKOUT_DIR,
};
env.NETLIFY_DB_URL = execFileSync("node", ["scripts/fresh-database.mjs", SERVER_DATABASE, "--test-mp", TEST_MP_EMAIL], {
  encoding: "utf8",
}).trim();
execFileSync("npx", ["next", "build"], { stdio: "inherit", env });
// The server keeps the address of each request a flow makes (scripts/record-requests.mjs). Not the build,
// which answers none.
const serving = {
  ...env,
  STORYBOARD_REQUESTS_DIR: REQUESTS_DIR,
  NODE_OPTIONS: `${env.NODE_OPTIONS ?? ""} --import=${pathToFileURL("scripts/record-requests.mjs").href}`.trim(),
};
// In this script's process group, which Playwright kills whole when the run
// ends, as Ctrl-C in a terminal does.
const server = spawn("node_modules/.bin/next", ["start", "--port", port], { env: serving, stdio: "inherit" });
server.on("exit", (code) => process.exit(code ?? 0));
