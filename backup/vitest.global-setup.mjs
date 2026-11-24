// Once, before the tests: unless the PG* variables name a server (CI's
// service, or the gate's own), their databases go on the site checkout's own
// Postgres, in memory (scripts/own-postgres.mjs), as the site's tests' do;
// or, where that can't start, on the local server, its socket found as the
// site's tests find it.
// Plain JavaScript, as the script it imports is.
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { checkoutPostgres, defaultHost } from "../scripts/own-postgres.mjs";

export default function setup() {
  if (process.env.PGHOST) return;
  const result = checkoutPostgres(dirname(dirname(fileURLToPath(import.meta.url))));
  if ("env" in result) return void Object.assign(process.env, result.env);
  console.warn(`The checkout's own Postgres didn't start (${result.problem}), so the local server is used.`);
  process.env.PGHOST = defaultHost();
}
