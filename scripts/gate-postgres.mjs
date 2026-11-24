// A Postgres of the gate's own, for `npm test` and the backup Worker's tests
// (scripts/gate.mjs), started for one gate and thrown away after it.
//
// Dropping a database makes Postgres write every changed page on the server
// to disk first, the other databases' too. On a shared server, while builds
// and screenshots keep the disk busy, those writes wait on the kernel, and
// every test that drops a database waits with them, sometimes past its time
// limit. This server's files are in memory (/dev/shm), and its only pages are
// the tests', so a drop waits on neither. The storyboard keeps the usual
// server: the fixture server it reuses from an earlier review would be
// looking at that one.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";

const PREFIX = "gate-postgres-";

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

/** Where the gate's servers live: in memory where there's /dev/shm (Linux), else the temporary folder. */
export function postgresBase(shm = "/dev/shm") {
  return existsSync(shm) ? shm : tmpdir();
}

/** The folder of the gate `pid`'s server: its data, its log and its socket. */
export const postgresDir = (pid, base = postgresBase()) => join(base, `${PREFIX}${pid}`);

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
