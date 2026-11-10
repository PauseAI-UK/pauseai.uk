// What this checkout's storyboard calls the things it makes on the Postgres
// server, in the temporary directory and on localhost's ports, which every
// checkout of the repo shares. Each name and port comes from a hash of the
// checkout's path, so a worktree's run beside the main checkout's never
// drops the other's databases, reads its emails or tests its build.
//
// Plain JavaScript, as the scripts import it with Node, and apart from
// lib/server/fixtures/fixture-env.mjs, which the site's own code imports.
// From the repo root, where every script and test runs. (Not import.meta:
// Playwright's loader compiles to CommonJS.)
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CHECKOUT_HEADER, FLOW_DATABASE_PREFIX } from "../lib/server/fixtures/fixture-env.mjs";

/** The checkout's path, which its fixture build answers with (scripts/serve-fixture.mjs). */
export const CHECKOUT_DIR = process.cwd();

/** A short hash of a checkout's path. */
function checkoutHash(dir) {
  return createHash("sha256").update(dir).digest("hex").slice(0, 8);
}

const CHECKOUT = checkoutHash(CHECKOUT_DIR);

/**
 * The ports between 3100 and 4999 that fetch and browsers refuse to
 * connect to, from the Fetch standard's bad ports
 * (https://fetch.spec.whatwg.org/#bad-port): none of them is the last pair's.
 */
export const BLOCKED_PORTS = [3659, 4045, 4190];

/**
 * The ports a checkout's storyboard serves on: its own build's, and main's
 * beside it, for the review. A pair between 3100 and 4999, from the hash of
 * its path, so the same checkout always gets the same, and the dev server's
 * 3000 is left alone. A pair with a port that fetch and browsers refuse
 * (BLOCKED_PORTS) gives way to the next. Two checkouts can still share a
 * pair: `npm run worktree` warns of it.
 *
 * @param {string} dir
 */
export function checkoutPorts(dir) {
  let local = 3100 + 2 * (parseInt(checkoutHash(dir), 16) % 950);
  while (BLOCKED_PORTS.includes(local) || BLOCKED_PORTS.includes(local + 1)) local += 2;
  return { local, main: local + 1 };
}

const PORTS = checkoutPorts(CHECKOUT_DIR);
/** This checkout's own build, under test, on its own port. */
export const OWN_URL = `http://localhost:${PORTS.local}`;
/** The build the storyboard drives: this checkout's, unless LOCAL_URL names another (scripts/storyboard.mjs runs main's this way). */
export const LOCAL_URL = process.env.LOCAL_URL ?? OWN_URL;
/** Main's build (scripts/serve-main.mjs), for the storyboard's comparison. */
export const MAIN_URL = process.env.MAIN_URL ?? `http://localhost:${PORTS.main}`;

/**
 * Why the server at this checkout's own port isn't its build, or undefined
 * if it is: `served` is the checkout its response named, if any.
 *
 * @param {string | null} served
 */
export function foreignServer(served, dir = CHECKOUT_DIR, url = OWN_URL) {
  if (served === dir) return undefined;
  const what = served
    ? `a fixture build of ${served}`
    : `something that isn't a fixture build of a checkout (no ${CHECKOUT_HEADER} header)`;
  return `${url} is serving ${what}, not this checkout's (${dir}). Stop that server and run again.`;
}

/** Where the build under test writes its emails (lib/server/fixtures/outbox.ts). */
export const OUTBOX_DIR = process.env.OUTBOX_DIR ?? join(tmpdir(), `pauseai-storyboard-outbox-${CHECKOUT}`);
/** Where a flow writes mail to the letters inbox, for the build's fake Gmail to pick up (lib/server/fixtures/letters-inbox.ts); as lib/server/fixtures/fixture-env.mjs tells the build. */
export const LETTERS_INBOX_DIR = join(OUTBOX_DIR, "letters-inbox");
/** Where a flow says which outside services fail for it (lib/server/fixtures/failing-services.ts). */
export const FAILING_DIR = join(OUTBOX_DIR, "failing");
/** Where main's fixture build (scripts/serve-main.mjs) writes its emails. */
export const MAIN_OUTBOX_DIR = join(tmpdir(), `pauseai-storyboard-main-outbox-${CHECKOUT}`);
/** Main's checkout, kept between reviews (scripts/serve-main.mjs). */
export const MAIN_WORKTREE = join(tmpdir(), `pauseai-storyboard-main-${CHECKOUT}`);

/** This checkout's flows' databases (tests/storyboard/fixtures.ts): FLOW_DATABASE_PREFIX, which the build accepts, then the checkout. */
export const FLOW_DATABASES = `${FLOW_DATABASE_PREFIX}${CHECKOUT}_`;
/** The migrated template, with the test MPs, that each flow's database is copied from. Doesn't match the prefix: a cookie can't name it. */
export const TEMPLATE_DATABASE = `pauseai_storyboard_template_${CHECKOUT}`;
/** The build's own database, for requests with no cookie. */
export const SERVER_DATABASE = `pauseai_storyboard_${CHECKOUT}`;
/** Main's build's own database. */
export const MAIN_DATABASE = `pauseai_storyboard_main_${CHECKOUT}`;
