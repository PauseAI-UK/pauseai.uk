// Postgres servers of the tests' own, with their files in memory: one for
// each checkout, which its tests, storyboard and fixture builds share, and
// one for each run of the gate, for the backup Worker's tests
// (scripts/gate.mjs).
//
// Dropping a database makes Postgres write every changed page on the server
// to disk first, the other databases' too. On a server on disk, while builds
// and screenshots keep the disk busy, those writes wait on the kernel, and
// every test that drops a database waits with them, sometimes past its time
// limit. These servers' files are in memory (/dev/shm), so a drop waits on
// no disk, and each checkout's pages are its own.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { checkoutHash } from "../tests/checkout.mjs";

const PREFIX = "gate-postgres-";
const CHECKOUT_PREFIX = "checkout-postgres-";

/**
 * As CI's Postgres service is made (.github/workflows/ci.yml), so sorting and
 * text compare as they do there, whatever this machine's locale.
 */
export const INITDB_ARGS = [
  "--auth=trust",
  "--locale-provider=builtin",
  "--builtin-locale=C.UTF-8",
  "--locale=C.UTF-8",
  "--encoding=UTF8",
];

/**
 * How the server runs: on a socket in its own folder, no TCP, nothing waiting
 * on the disk (its data is thrown away), and the clock in UTC, as CI's.
 */
export function serverOptions(dir) {
  return [
    `-k ${dir}`,
    "-c listen_addresses=''",
    "-c fsync=off",
    "-c full_page_writes=off",
    "-c synchronous_commit=off",
    "-c max_connections=200",
    "-c timezone=Etc/UTC",
  ].join(" ");
}

/** Where the servers live: in memory where there's /dev/shm (Linux), else the temporary folder. */
export function postgresBase(shm = "/dev/shm") {
  return existsSync(shm) ? shm : tmpdir();
}

/** Where a local server listens when PGHOST doesn't say: the usual server, where a checkout's own can't start. */
export function defaultHost(port = process.env.PGPORT ?? "5432", places = ["/var/run/postgresql", "/tmp"]) {
  return places.find((dir) => existsSync(join(dir, `.s.PGSQL.${port}`))) ?? "localhost";
}

/** The folder of the gate `pid`'s server: its data, its log and its socket. */
export const postgresDir = (pid, base = postgresBase()) => join(base, `${PREFIX}${pid}`);

/** The folder of the server of the checkout at `checkout`, named from a hash of its path, as its ports are (tests/checkout.mjs). */
export const checkoutPostgresDir = (checkout, base = postgresBase()) =>
  join(base, `${CHECKOUT_PREFIX}${checkoutHash(checkout)}`);

/** The variables that point psql, createdb and the tests (scripts/fresh-database.mjs) at the server in `dir`. */
export function postgresEnv(dir, user = userInfo().username) {
  return { PGHOST: dir, PGPORT: "5432", PGUSER: user };
}

/**
 * Makes and starts a server in `dir`, and returns the variables that reach
 * it; or, if it can't (no initdb on the PATH, say), why not.
 *
 * @returns {{ env: Record<string, string> } | { problem: string }}
 */
export function startPostgres(dir, run = execFileSync, user = userInfo().username) {
  try {
    rmSync(dir, { recursive: true, force: true });
    run("initdb", ["--pgdata", join(dir, "data"), `--username=${user}`, ...INITDB_ARGS], { stdio: "pipe" });
    run(
      "pg_ctl",
      ["--pgdata", join(dir, "data"), "--log", join(dir, "log"), "--wait", "-o", serverOptions(dir), "start"],
      {
        stdio: "pipe",
      },
    );
    return { env: postgresEnv(dir, user) };
  } catch (error) {
    stopPostgres(dir, run);
    const output = String(error.stderr ?? "").trim();
    return { problem: output.split("\n").at(-1) || error.message };
  }
}

/** Stops the server in `dir`, if one's running, and deletes it. */
export function stopPostgres(dir, run = execFileSync) {
  try {
    run("pg_ctl", ["--pgdata", join(dir, "data"), "--mode=immediate", "stop"], { stdio: "pipe" });
  } catch {
    // Never started, or gone already.
  }
  rmSync(dir, { recursive: true, force: true });
}

/** Whether process `pid` is running. */
export function isRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

/**
 * Stops and deletes the servers in `base` of gates that are no longer
 * running: one killed before it could stop its own. Returns their folders.
 */
export function sweepPostgres(base = postgresBase(), running = isRunning, stop = stopPostgres) {
  const left = readdirSync(base).filter((name) => {
    const pid = name.startsWith(PREFIX) ? Number(name.slice(PREFIX.length)) : NaN;
    return Number.isInteger(pid) && pid > 0 && !running(pid);
  });
  const dirs = left.map((name) => join(base, name));
  for (const dir of dirs) stop(dir);
  return dirs;
}

/**
 * Whether the server in `dir` is up and taking connections: its
 * postmaster.pid names a running process, and says "ready" on its eighth
 * line, as Postgres writes it once it is.
 */
export function isReady(dir, running = isRunning) {
  let lines;
  try {
    lines = readFileSync(join(dir, "data", "postmaster.pid"), "utf8").split("\n");
  } catch {
    return false;
  }
  return running(Number(lines[0])) && lines[7]?.trim() === "ready";
}

/** The file in a checkout's server's folder that names the checkout. */
const CHECKOUT_FILE = "checkout";

/**
 * Stops and deletes the servers in `base` of checkouts that are gone: a
 * worktree removed while its server ran. One still starting, with no
 * checkout named yet, is left alone. Returns their folders.
 */
export function sweepCheckoutPostgres(base = postgresBase(), exists = existsSync, stop = stopPostgres) {
  const dirs = readdirSync(base)
    .filter((name) => name.startsWith(CHECKOUT_PREFIX) && !name.endsWith(".lock"))
    .map((name) => join(base, name))
    .filter((dir) => {
      try {
        return !exists(readFileSync(join(dir, CHECKOUT_FILE), "utf8"));
      } catch {
        return false;
      }
    });
  for (const dir of dirs) stop(dir);
  return dirs;
}

/** Waits `ms` milliseconds, holding up this process: the callers are synchronous, as psql's are. */
function pause(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * How long one start may hold the lock before another takes it as left by a
 * process that was killed: initdb and a start take a couple of seconds, and
 * under twenty on a loaded machine.
 */
const STALE_LOCK_MS = 120_000;

/**
 * Makes sure the server of the checkout at `checkout` is running, and
 * returns the variables that reach it; or, if it can't start (no initdb on
 * the PATH, say), why not. The server stays up after the process that
 * started it ends, for the next run in the checkout, until the machine
 * restarts (/dev/shm is in memory) or the checkout is gone
 * (sweepCheckoutPostgres). Several processes can ask at once, Vitest's and
 * Playwright's workers say: the one that makes the lock folder starts the
 * server, and the rest wait for it.
 *
 * @returns {{ env: Record<string, string> } | { problem: string }}
 */
export function checkoutPostgres(
  checkout = process.cwd(),
  { base = postgresBase(), run = execFileSync, user = userInfo().username, wait = pause, now = Date.now } = {},
) {
  const dir = checkoutPostgresDir(checkout, base);
  const lock = `${dir}.lock`;
  const started = now();
  while (!isReady(dir)) {
    try {
      mkdirSync(lock);
    } catch (error) {
      if (error.code !== "EEXIST") return { problem: error.message };
      if (now() - started > STALE_LOCK_MS) return { problem: `${lock} was held for over two minutes` };
      try {
        if (now() - statSync(lock).mtimeMs > STALE_LOCK_MS) rmSync(lock, { recursive: true, force: true });
      } catch {
        // Let go of since we looked.
      }
      wait(100);
      continue;
    }
    try {
      if (isReady(dir)) break;
      sweepCheckoutPostgres(base);
      stopPostgres(dir, run);
      const result = startPostgres(dir, run, user);
      if ("problem" in result) return result;
      writeFileSync(join(dir, CHECKOUT_FILE), checkout);
      break;
    } finally {
      rmSync(lock, { recursive: true, force: true });
    }
  }
  return { env: postgresEnv(dir, user) };
}

//   npm run db:own                 starts this checkout's server, if it isn't running, and prints the variables that reach it
//   npm run db:own -- psql [args]  runs psql on it, in its postgres database unless the arguments name another
if (process.argv[1]?.endsWith("own-postgres.mjs")) {
  const result = checkoutPostgres();
  if ("problem" in result) {
    console.error(`This checkout's Postgres didn't start: ${result.problem}`);
    process.exit(1);
  }
  if (process.argv[2] === "psql") {
    const env = { PGDATABASE: "postgres", ...process.env, ...result.env };
    process.exit(spawnSync("psql", process.argv.slice(3), { stdio: "inherit", env }).status ?? 1);
  }
  for (const [name, value] of Object.entries(result.env)) console.log(`${name}=${value}`);
}
