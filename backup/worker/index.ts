import { Container, getContainer } from "@cloudflare/containers";
import { describe, report, type AlertEnv } from "./alerts.ts";
import { RULES } from "./checks.ts";
import { takeBackup, type Outcome } from "./run.ts";

// The Worker: every night (the cron in wrangler.jsonc) it starts the
// container, takes a backup and archives the messages the site keeps
// outside the database, stores them in R2, and reports how it went.
// POST /run, with RUN_SECRET as a bearer token, does the same at once and
// replies with the report.

export interface Env extends AlertEnv {
  /** A read-only connection string for the live database. */
  DATABASE_URL: string;
  RUN_SECRET?: string;
  /** The site, and the secret its backup route takes (its BACKUP_SECRET), for the container to fetch its messages. */
  SITE_URL: string;
  SITE_BACKUP_SECRET?: string;
  BACKUPS: R2Bucket;
  BACKUP_CONTAINER: DurableObjectNamespace<BackupContainer>;
}

export class BackupContainer extends Container<Env> {
  defaultPort = 8080;
  // A request in flight keeps it awake, however long the backup takes.
  sleepAfter = "2m";

  constructor(ctx: Container<Env>["ctx"], env: Env) {
    super(ctx, env);
    this.envVars = {
      DATABASE_URL: env.DATABASE_URL,
      SITE_URL: env.SITE_URL,
      ...(env.SITE_BACKUP_SECRET && { SITE_BACKUP_SECRET: env.SITE_BACKUP_SECRET }),
    };
  }
}

export async function backUpAndReport(env: Env, now = new Date()): Promise<Outcome> {
  const container = getContainer(env.BACKUP_CONTAINER);
  const outcome = await takeBackup({
    bucket: env.BACKUPS,
    container: (path, init) => container.fetch(new Request(`http://container${path}`, init)),
    // R2 needs to know a stream's length up front, and checks the hash.
    upload: async (key, body, { bytes, sha256 }) => {
      const { readable, writable } = new FixedLengthStream(bytes);
      await Promise.all([body.pipeTo(writable), env.BACKUPS.put(key, readable, { sha256 })]);
    },
    rules: RULES,
    now,
  });
  await report(outcome, env);
  return outcome;
}

export default {
  async scheduled(_controller, env) {
    await backUpAndReport(env);
  },

  async fetch(request, env) {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/run") {
      return new Response("Not found", { status: 404 });
    }
    if (!env.RUN_SECRET || !(await sameText(request.headers.get("Authorization") ?? "", `Bearer ${env.RUN_SECRET}`))) {
      return new Response("Unauthorized", { status: 401 });
    }
    try {
      const outcome = await backUpAndReport(env);
      return new Response(describe(outcome), { status: outcome.problems.length ? 500 : 200 });
    } catch (error) {
      return new Response((error as Error).message, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

/** Compares two strings by their hashes, so the time it takes says nothing about the secret. */
async function sameText(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all(
    [a, b].map(async (text) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))),
  );
  return x.every((byte, i) => byte === y[i]);
}
