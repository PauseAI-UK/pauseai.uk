import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "./backup.ts";

// A throwaway database on the Postgres the PG* variables or the local socket
// point to, as the site's tests use.

/**
 * Makes the database and runs `setup` in it, from a file: the site's whole
 * schema is past the 128 KiB Linux allows one argument.
 */
export async function testDatabase(setup: string): Promise<{ url: string; drop(): Promise<void> }> {
  const name = `backup_test_${randomUUID().slice(0, 8)}`;
  await run("createdb", [name]);
  const url = `postgresql:///${name}`;
  const dir = await mkdtemp(join(tmpdir(), "backup-test-"));
  try {
    const file = join(dir, "setup.sql");
    await writeFile(file, setup);
    await run("psql", [url, "--no-psqlrc", "--quiet", "--set=ON_ERROR_STOP=1", "--file", file]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
  return { url, drop: () => run("dropdb", ["--force", name]).then(() => undefined) };
}
