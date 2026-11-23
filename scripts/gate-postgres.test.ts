import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  INITDB_ARGS,
  isRunning,
  postgresBase,
  postgresDir,
  postgresEnv,
  serverOptions,
  startPostgres,
  stopPostgres,
  sweepPostgres,
} from "./gate-postgres.mjs";

const temporary = () => mkdtempSync(join(tmpdir(), "gate-postgres-test-"));

/** A stand-in for execFileSync that records each command, failing those `fails` names. */
function recorder(fails: string[] = [], stderr = "initdb: error: no such locale\n") {
  const calls: string[][] = [];
  const run = (command: string, args: string[]) => {
    calls.push([command, ...args]);
    if (fails.includes(command)) throw Object.assign(new Error(`${command} failed`), { stderr: Buffer.from(stderr) });
    return "";
  };
  return { calls, run };
}

describe("where the server lives", () => {
  it("is in memory where there's /dev/shm, else the temporary folder", () => {
    const shm = temporary();
    expect(postgresBase(shm)).toBe(shm);
    expect(postgresBase(join(shm, "missing"))).toBe(tmpdir());
  });

  it("is a folder named after the gate's process", () => {
    expect(postgresDir(4242, "/dev/shm")).toBe("/dev/shm/gate-postgres-4242");
  });
});

describe("postgresEnv", () => {
  it("points the PG* variables at the server's socket", () => {
    expect(postgresEnv("/dev/shm/gate-postgres-1", "jane")).toEqual({
      PGHOST: "/dev/shm/gate-postgres-1",
      PGPORT: "5432",
      PGUSER: "jane",
    });
  });
});

describe("startPostgres", () => {
  it("makes the server as CI's is made, starts it on its own socket, and returns its variables", () => {
    const { calls, run } = recorder();
    const dir = join(temporary(), "server");
    expect(startPostgres(dir, run, "jane")).toEqual({ env: postgresEnv(dir, "jane") });
    expect(calls).toEqual([
      ["initdb", "--pgdata", join(dir, "data"), "--username=jane", ...INITDB_ARGS],
      ["pg_ctl", "--pgdata", join(dir, "data"), "--log", join(dir, "log"), "--wait", "-o", serverOptions(dir), "start"],
    ]);
    expect(serverOptions(dir)).toContain(`-k ${dir} `);
  });

  it("says why when the server won't start, from the last line of what the command said, and cleans up", () => {
    const { calls, run } = recorder(["initdb"]);
    const dir = join(temporary(), "server");
    mkdirSync(dir);
    expect(startPostgres(dir, run, "jane")).toEqual({ problem: "initdb: error: no such locale" });
    expect(calls.at(-1)?.slice(0, 2)).toEqual(["pg_ctl", "--pgdata"]);
    expect(existsSync(dir)).toBe(false);
  });

  it("gives the error's message when the command said nothing, or wasn't there", () => {
    expect(startPostgres(join(temporary(), "a"), recorder(["initdb"], "").run)).toEqual({ problem: "initdb failed" });
    const missing = () => {
      throw new Error("spawnSync initdb ENOENT");
    };
    expect(startPostgres(join(temporary(), "b"), missing)).toEqual({ problem: "spawnSync initdb ENOENT" });
  });
});

describe("stopPostgres", () => {
  it("stops the server at once and deletes its folder, whether or not one was running", () => {
    const dir = temporary();
    const { calls, run } = recorder(["pg_ctl"]);
    stopPostgres(dir, run);
    expect(calls).toEqual([["pg_ctl", "--pgdata", join(dir, "data"), "--mode=immediate", "stop"]]);
    expect(existsSync(dir)).toBe(false);
  });
});

describe("sweepPostgres", () => {
  it("stops the servers of gates no longer running, and leaves the rest", () => {
    const base = temporary();
    for (const name of ["gate-postgres-11", "gate-postgres-22", "gate-postgres-x", "other-33"])
      mkdirSync(join(base, name));
    const stopped: string[] = [];
    const found = sweepPostgres(
      base,
      (pid) => pid === 22,
      (dir) => stopped.push(dir),
    );
    expect(found).toEqual([join(base, "gate-postgres-11")]);
    expect(stopped).toEqual(found);
  });
});

describe("isRunning", () => {
  it("knows this process runs, and one that has exited doesn't", () => {
    expect(isRunning(process.pid)).toBe(true);
    const gone = spawnSync("node", ["-e", ""]).pid;
    expect(isRunning(gone)).toBe(false);
  });

  it("counts a process it may not signal as running", () => {
    // Process 1 is always there, and belongs to root.
    expect(isRunning(1)).toBe(true);
  });
});

const hasInitdb = spawnSync("initdb", ["--version"]).status === 0;

// CI's test jobs have Postgres's client, not its server, so this runs where initdb is installed.
describe.skipIf(!hasInitdb)("a real server", () => {
  it("starts, makes databases with the site's extensions in CI's collation, and is gone once stopped", () => {
    const dir = postgresDir(process.pid, temporary());
    const started = startPostgres(dir);
    expect(started).toHaveProperty("env");
    try {
      const env = { ...process.env, ...(started as { env: Record<string, string> }).env };
      execFileSync("createdb", ["gate_postgres_test"], { env });
      const said = execFileSync(
        "psql",
        [
          "-XAtq",
          "-d",
          "gate_postgres_test",
          "-c",
          "CREATE EXTENSION pg_trgm; CREATE EXTENSION unaccent; SELECT datcollate, current_setting('TimeZone') FROM pg_database WHERE datname = current_database()",
        ],
        { env, encoding: "utf8" },
      );
      expect(said.trim()).toBe("C.UTF-8|Etc/UTC");
    } finally {
      stopPostgres(dir);
    }
    expect(existsSync(dir)).toBe(false);
  });
});
