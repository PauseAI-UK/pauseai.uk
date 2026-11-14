import "server-only";
import { config } from "@/lib/server/config.server";
import { timingSafeEqual } from "node:crypto";

/**
 * Whether a request comes from our scheduled functions (netlify/functions/),
 * which send CRON_SECRET as a bearer token. Without CRON_SECRET, nothing is.
 */
export function isCronRequest(request: Request): boolean {
  return hasSecret(request, config.cronSecret);
}

/**
 * Whether a request comes from the backup Worker (backup/), which sends
 * BACKUP_SECRET as a bearer token. Without BACKUP_SECRET, nothing is.
 */
export function isBackupRequest(request: Request): boolean {
  return hasSecret(request, config.backupSecret);
}

function hasSecret(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
