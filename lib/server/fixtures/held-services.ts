// An outside service slow to answer, for one storyboard flow alone, so a
// frame can show a page while a run that calls it is going: the flow
// writes the service's host to FAILING_DIR/<scope>.held, its database's
// name (holdService), and every call the site makes there for the flow
// waits (whileHeld, which outside-fetch.server.ts asks first) until the
// flow lets it go (releaseService), then is answered as usual. Beside the
// services a flow makes fail (failing-services.ts), in the same folder.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const heldFile = (scope: string, dir: string) => join(dir, `${scope}.held`);

/** Holds every call to `host` for the flow on `scope`, from now until releaseService. */
export function holdService(scope: string, host: string, dir: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(heldFile(scope, dir), host);
}

/** Lets the flow on `scope`'s held calls go. */
export function releaseService(scope: string, dir: string): void {
  rmSync(heldFile(scope, dir), { force: true });
}

function isHeld(hostname: string, scope: string | undefined, dir: string | undefined): boolean {
  if (!scope || !dir) return false;
  const file = heldFile(scope, dir);
  return existsSync(file) && readFileSync(file, "utf8") === hostname;
}

/** How often a held call looks again, and the longest it waits, so a flow that never lets go fails on its check rather than hanging the server. */
const LOOK_EVERY_MS = 50;
const MOST_MS = 30_000;

/** Waits while the flow on `scope` holds `hostname`, for at most MOST_MS. */
export async function whileHeld(hostname: string, scope?: string, dir = process.env.FAILING_DIR): Promise<void> {
  const until = Date.now() + MOST_MS;
  while (isHeld(hostname, scope, dir) && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, LOOK_EVERY_MS));
  }
}
