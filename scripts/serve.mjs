#!/usr/bin/env node
// Serves a branch on fixture data, to click around from another machine (the
// Mac this container runs on, say): `next dev` in the branch's worktree, so
// edits show as they're saved, with a fresh database of fixture data, behind
// a proxy that the other machine reaches on this one's network address.
//
//   npm run serve -- [<branch> | <PR number>]   serves it until stopped (Ctrl-C)
//   npm run serve -- [<branch> | <PR number>] --stop
//
// With no branch, the worktree it's run in. A branch without a worktree gets
// one under tmp/worktrees/, as `npm run worktree` makes, from the local
// branch or else origin's. Never the main checkout: its `next dev` is the
// person's own (docs/development.md, "Serving a branch").
//
// The proxy is there for the session cookie, which is Secure, so a browser
// drops it over plain http from anywhere but localhost: the proxy strips
// Secure from every cookie the site sets, and tells `next dev` each request
// came to localhost, as Server Actions check that the Origin matches.
// Fixture builds only: it serves no real data.
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request as httpRequest } from "node:http";
import { connect } from "node:net";
import { networkInterfaces, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checkoutPorts } from "../tests/checkout.mjs";
import { worktreePath, worktreePaths } from "./worktree.mjs";

/**
 * The ports above 5000 that fetch and browsers refuse to connect to, from the
 * Fetch standard's bad ports (https://fetch.spec.whatwg.org/#bad-port).
 */
const BLOCKED_PORTS = [5060, 5061, 6000, 6566, 6665, 6666, 6667, 6668, 6669, 6679, 6697];

/**
 * The ports a checkout is served on: the proxy's, which the link names, and
 * `next dev`'s behind it, on localhost. 2000 above its storyboard's pair, so
 * the same checkout always gets the same and they never clash; a pair with a
 * port browsers refuse gives way to the next.
 */
export function servePorts(dir) {
  let proxy = checkoutPorts(dir).local + 2000;
  while (BLOCKED_PORTS.includes(proxy) || BLOCKED_PORTS.includes(proxy + 1)) proxy += 2;
  return { proxy, next: proxy + 1 };
}

/** What the command line asks for: a branch, a PR's number, or neither, and whether to stop it. */
export function parseArgs(args) {
  const stop = args.includes("--stop");
  const rest = args.filter((arg) => arg !== "--stop");
  if (rest.length > 1 || rest.some((arg) => arg.startsWith("-"))) return undefined;
  const [target] = rest;
  if (target === undefined) return { stop };
  return /^\d+$/.test(target) ? { pr: Number(target), stop } : { branch: target, stop };
}

/** The worktree that has `branch` checked out, from `git worktree list --porcelain`, if one does. */
export function worktreeOf(porcelain, branch) {
  let path;
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) path = line.slice("worktree ".length);
    if (line === `branch refs/heads/${branch}`) return path;
  }
  return undefined;
}

/** This machine's address on its network, the first that isn't loopback, for the link. */
export function networkAddress(interfaces = networkInterfaces()) {
  const all = Object.values(interfaces).flat();
  return all.find((address) => address?.family === "IPv4" && !address.internal)?.address ?? "localhost";
}

/** A request's headers, as `next dev` on `local` (host:port) should see them: sent to it, from it. */
export function towardsNext(headers, local) {
  const sent = { ...headers, host: local };
  if (sent.origin) sent.origin = `http://${local}`;
  if (sent.referer) sent.referer = sent.referer.replace(/^https?:\/\/[^/]+/, `http://${local}`);
  return sent;
}

/** A response's Set-Cookie headers without Secure, so a browser keeps them over plain http. */
export function withoutSecure(cookies) {
  return cookies?.map((cookie) => cookie.replace(/;\s*Secure(?=;|$)/gi, ""));
}

/**
 * The proxy: every request, WebSocket upgrades too (`next dev` reloads the
 * page over one), passed to `next dev` on localhost's `nextPort`.
 */
function startProxy(port, nextPort) {
  const local = `localhost:${nextPort}`;
  const server = createServer((req, res) => {
    const upstream = httpRequest(
      {
        host: "127.0.0.1",
        port: nextPort,
        method: req.method,
        path: req.url,
        headers: towardsNext(req.headers, local),
      },
      (answer) => {
        const headers = { ...answer.headers, "set-cookie": withoutSecure(answer.headers["set-cookie"]) };
        if (!headers["set-cookie"]) delete headers["set-cookie"];
        res.writeHead(answer.statusCode ?? 502, headers);
        answer.pipe(res);
      },
    );
    upstream.on("error", (error) => {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`next dev isn't answering: ${error.message}`);
    });
    req.pipe(upstream);
  });
  server.on("upgrade", (req, socket, head) => {
    const upstream = connect(nextPort, "127.0.0.1", () => {
      const headers = towardsNext(req.headers, local);
      const lines = Object.entries(headers).flatMap(([name, value]) =>
        (Array.isArray(value) ? value : [value]).map((one) => `${name}: ${one}`),
      );
      upstream.write(`${req.method} ${req.url} HTTP/1.1\r\n${lines.join("\r\n")}\r\n\r\n`);
      upstream.write(head);
      socket.pipe(upstream).pipe(socket);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });
  server.listen(port, "0.0.0.0");
  return server;
}

const git = (args, cwd) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

/** The worktree to serve, made if need be, or to stop serving. */
function worktreeFor({ branch, pr, stop }) {
  const root = dirname(git(["rev-parse", "--path-format=absolute", "--git-common-dir"]));
  if (pr !== undefined) {
    branch = execFileSync("gh", ["pr", "view", String(pr), "--json", "headRefName", "-q", ".headRefName"], {
      encoding: "utf8",
    }).trim();
  }
  let dir = branch === undefined ? git(["rev-parse", "--show-toplevel"]) : undefined;
  if (branch !== undefined) {
    dir = worktreeOf(git(["worktree", "list", "--porcelain"]), branch);
    if (!dir && stop) throw new Error(`${branch} has no worktree, so nothing is serving it.`);
    if (!dir) {
      dir = worktreePath(root, branch);
      execFileSync("git", ["fetch", "origin"], { stdio: "inherit" });
      const local = git(["branch", "--list", branch]);
      execFileSync(
        "git",
        local
          ? ["worktree", "add", dir, branch]
          : ["worktree", "add", "--no-track", "-b", branch, dir, `origin/${branch}`],
        { stdio: "inherit" },
      );
      execFileSync("npm", ["ci", "--prefer-offline", "--no-audit", "--no-fund"], { cwd: dir, stdio: "inherit" });
    }
  }
  if (dir === worktreePaths(git(["worktree", "list", "--porcelain"]))[0]) {
    throw new Error("That's the main checkout, whose next dev is the person's own: serve a worktree.");
  }
  return dir;
}

/** Where a served checkout keeps the process to stop. */
const pidFile = (dir) => join(dir, "tmp", "serve.json");

function stop(dir) {
  if (!existsSync(pidFile(dir))) return console.log(`Nothing is serving ${dir}.`);
  const { pid } = JSON.parse(readFileSync(pidFile(dir), "utf8"));
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Stopped serving ${dir}.`);
  } catch {
    console.log(`Nothing is serving ${dir} any more.`);
  }
  rmSync(pidFile(dir), { force: true });
}

/** Runs the worktree's own copy of the database script, as the migrations are that branch's. */
function freshDatabase(dir, name, email, key) {
  const script = `
    import * as db from "./scripts/fresh-database.mjs";
    const url = db.freshDatabase(${JSON.stringify(name)});
    db.addTestMps(url, ${JSON.stringify(email)});
    db.addFixtureData(url);
    db.giveAdminSupporters(url);
    // So answers to the fake replies to broadcasts go from hello@; a branch from before it has no such step.
    db.connectBroadcastMailbox?.(url, ${JSON.stringify(key)});
    console.log(url);`;
  return execFileSync("node", ["--input-type=module", "-e", script], { cwd: dir, encoding: "utf8" }).trim();
}

async function waitFor(url, seconds) {
  for (let i = 0; i < seconds; i++) {
    try {
      const answer = await fetch(url, { redirect: "manual" });
      if (answer.status < 500) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((done) => setTimeout(done, 1000));
  }
  throw new Error(`${url} didn't answer in ${seconds}s.`);
}

/**
 * Opens the link in Firefox, as the person will: the home page loads, and
 * the login page's dev login (DevLogin) gets to the staff pages, so the
 * session cookie came through the proxy.
 */
async function checkInFirefox(link) {
  const { firefox } = await import("@playwright/test");
  const browser = await firefox.launch();
  try {
    const page = await browser.newPage();
    const home = await page.goto(link, { timeout: 120_000 });
    if (!home?.ok()) throw new Error(`Firefox got ${home?.status()} for ${link}.`);
    await page.goto(new URL("/staff/login", link).toString(), { timeout: 120_000 });
    await page.getByRole("button", { name: ADMIN }).click();
    await page.waitForURL((url) => url.pathname === "/staff", { timeout: 120_000 });
  } finally {
    await browser.close();
  }
}

/** The migrations' admin account, which the database gives every permission (giveAdminSupporters). */
const ADMIN = "admin@pauseai.uk";

async function main(args) {
  const asked = parseArgs(args);
  if (!asked) {
    console.error("Usage: npm run serve -- [<branch> | <PR number>] [--stop]");
    process.exit(2);
  }
  const dir = worktreeFor(asked);
  if (asked.stop) return stop(dir);

  const { proxy, next } = servePorts(dir);
  const link = `http://${networkAddress()}:${proxy}/`;
  const hash = createHash("sha256").update(dir).digest("hex").slice(0, 8);
  const outbox = join(tmpdir(), `pauseai-serve-outbox-${hash}`);
  // Read in the worktree, so it's that branch's.
  const { fixtureEnv, TEST_MP_EMAIL } = await import(join(dir, "lib", "server", "fixtures", "fixture-env.mjs"));
  const env = { ...process.env, ...fixtureEnv({ outboxDir: outbox, origin: link.slice(0, -1) }) };
  // The clock runs, and no analytics: it's to use, not to picture.
  delete env.FIXTURE_NOW;
  delete env.ANALYTICS;
  env.NETLIFY_DB_URL = freshDatabase(dir, `pauseai_serve_${hash}`, TEST_MP_EMAIL, env.GMAIL_TOKEN_KEY);

  // In its own process group, so stopping it stops what it starts.
  const server = spawn(
    join(dir, "node_modules", ".bin", "next"),
    ["dev", "--turbopack", "--hostname", "127.0.0.1", "--port", String(next)],
    {
      cwd: dir,
      env,
      stdio: ["ignore", "inherit", "inherit"],
      detached: true,
    },
  );
  const stopAll = () => {
    try {
      process.kill(-server.pid, "SIGTERM");
    } catch {
      // Gone already.
    }
    rmSync(pidFile(dir), { force: true });
    process.exit(0);
  };
  process.on("SIGINT", stopAll);
  process.on("SIGTERM", stopAll);
  server.on("exit", (code) => {
    console.error(`next dev stopped (${code}).`);
    stopAll();
  });
  mkdirSync(join(dir, "tmp"), { recursive: true });
  writeFileSync(pidFile(dir), JSON.stringify({ pid: process.pid, link }));

  startProxy(proxy, next);
  await waitFor(`http://127.0.0.1:${next}/`, 300);
  await checkInFirefox(link);

  console.log(`\nServing ${dir} at ${link}`);
  console.log(`Log in at ${link}staff/login with the dev login's ${ADMIN}, who can open every staff page.`);
  console.log(`The emails the site sends are in ${outbox}. Stop with Ctrl-C, or npm run serve -- --stop.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
