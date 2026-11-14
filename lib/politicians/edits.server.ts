import "server-only";
import { changedFields } from "@/lib/field-changes";
import { isSharedInbox } from "@/lib/letters/one-off";
import { logChange } from "@/lib/server/audit.server";
import { query, transaction } from "@/lib/server/db.server";
import { relinkOneOffs } from "@/lib/letters/one-off-relink.server";

// What staff edit on a politician's page: only what no body's list has, as
// the imports keep the rest (lib/politicians/imports.server.ts). The two
// marks; a salutation the rule got wrong; and a Lord's email, as most
// Lords list none of their own. Each edit is logged, by the politician's ID,
// so their page can tell it.

/** The markers staff set by hand, by their names in a form. */
export const MARKS = { importantTarget: "important_target", personalConnection: "personal_connection" } as const;
export type Mark = keyof typeof MARKS;

export function isMark(value: string): value is Mark {
  return Object.hasOwn(MARKS, value);
}

/** Sets or clears one marker. */
export async function setMark(politicianId: number, mark: Mark, on: boolean, staff: string): Promise<void> {
  await transaction(async (db) => {
    const [row] = await query<{ name: string; was: boolean }>(
      `SELECT n.name, n.${MARKS[mark]} AS was FROM notable_people n WHERE n.id = $1 FOR UPDATE`,
      [politicianId],
      db,
    );
    if (!row || row.was === on) return;
    await query(
      `UPDATE notable_people SET ${MARKS[mark]} = $2, updated_at = now() WHERE id = $1`,
      [politicianId, on],
      db,
    );
    await logChange(
      staff,
      "edit politician",
      { id: politicianId, name: row.name, changed: { [mark]: [row.was, on] } },
      db,
    );
  });
}

/** What staff can change on a politician's page. */
export type PoliticianDetailsEdit = {
  salutation: string;
  /** Only a Lord's, as the imports keep everyone else's. */
  email?: string;
};

/** Why an edit wasn't saved. */
export type EditRefusal = "salutation" | "email" | "shared" | "gone";
export type EditResult = { saved: true } | { saved: false; why: EditRefusal };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Saves a politician's details as staff edited them: their salutation,
 * which is then checked, and a Lord's email. Says whether it saved, or why
 * not.
 */
export async function editPoliticianDetails(
  politicianId: number,
  edit: PoliticianDetailsEdit,
  staff: string,
): Promise<EditResult> {
  const salutation = edit.salutation.trim();
  if (!salutation) return { saved: false, why: "salutation" };
  const email = edit.email?.trim().toLowerCase();
  if (email && !EMAIL.test(email)) return { saved: false, why: "email" };
  if (email && isSharedInbox(email)) return { saved: false, why: "shared" };
  const result = await transaction(async (db): Promise<EditResult> => {
    const [was] = await query<{ name: string; salutation: string; email: string | null; house: string }>(
      `SELECT n.name, n.salutation, n.email, p.house FROM notable_people n JOIN politicians p ON p.id = n.id
       WHERE n.id = $1 AND NOT p.is_test FOR UPDATE OF n`,
      [politicianId],
      db,
    );
    if (!was) return { saved: false, why: "gone" };
    const after = {
      salutation,
      email: was.house === "lords" && edit.email !== undefined ? email || null : was.email,
    };
    const changed = changedFields({ salutation: was.salutation, email: was.email }, after);
    if (Object.keys(changed).length === 0) return { saved: true };
    await query(
      "UPDATE notable_people SET salutation = $2, salutation_to_check = false, email = $3, updated_at = now() WHERE id = $1",
      [politicianId, after.salutation, after.email],
      db,
    );
    await logChange(staff, "edit politician", { id: politicianId, name: was.name, changed }, db);
    return { saved: true };
  });
  // A new email says whose more threads are.
  if (result.saved && email) await relinkOneOffs(Date.now());
  return result;
}
