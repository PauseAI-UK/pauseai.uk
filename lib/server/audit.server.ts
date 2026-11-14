import "server-only";
import type { AuditAction, AuditDetails } from "@/lib/audit-events";
import { query, type Queryable } from "./db.server";

// Who changed what: every change from the staff interface, and each sync,
// which every feature logs. The log's page reads it (lib/oversight/audit-log.server.ts).

/** A row of the log as it's read: an action it may not know, with the details logged (lib/audit-events.ts says what each holds). */
export type AuditEntry = { id: number; at: Date; actor: string; action: string; details: Record<string, unknown> };

/** An action and its details, as AuditDetails pairs them, and the transaction to log in, if any. */
type LogArgs = { [A in keyof AuditDetails]: [action: A, details: AuditDetails[A], db?: Queryable] }[keyof AuditDetails];

/** `actor` is a staff email, or "sync". Pass `db` to log inside a transaction. */
export async function logChange(actor: string, ...[action, details, db]: LogArgs): Promise<void> {
  await query(
    "INSERT INTO audit_log (actor, action, details) VALUES ($1, $2, $3)",
    [actor, action, JSON.stringify(details)],
    db,
  );
}

/** Actions as a list of SQL strings, for `action IN (…)` or `ARRAY[…]`. */
export function auditActions(...actions: AuditAction[]): string {
  return actions.map((action) => `'${action}'`).join(", ");
}
