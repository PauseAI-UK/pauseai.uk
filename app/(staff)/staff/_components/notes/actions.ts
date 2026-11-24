"use server";

// The notes' Server Actions. Each is a public endpoint, so each calls
// requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { refused, type FormResult } from "@/lib/form-result";
import type { NoteUnchanged } from "@/lib/notes/notes";
import { noteEditFrom, noteFrom, ownId } from "@/lib/staff-forms";
import { addNote, deleteNote, editNote, type NoteTarget } from "@/lib/notes/records.server";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth.server";

/** Refreshes the page of whom a note is about. */
function refreshNotes(target: NoteTarget): void {
  revalidatePath(
    "supporterId" in target ? `/staff/supporters/${target.supporterId}` : `/staff/politicians/${target.politicianId}`,
  );
}

/** Refreshes every staff page, for a note that has gone: nothing's left to say whose page it was on. */
function refreshEveryPage(): void {
  revalidatePath("/staff", "layout");
}

/**
 * The form under the notes on a supporter's or a politician's page: adds
 * one, as the staff member. Refused for a note that says nothing, or when
 * whoever it's about has gone since the page loaded, which their page,
 * refreshed, says over its not being there. A supporter's page needs
 * `supporters`, so a note on one sent without it is thrown, as a request
 * made up.
 */
export async function addNoteNow(form: FormData): Promise<FormResult<"blank" | "gone">> {
  const staff = await requireStaff();
  const parsed = noteFrom(form);
  if (!parsed.ok) return parsed;
  if ("supporterId" in parsed.target && !canSeeSupporters(staff))
    throw new Error("A note on a supporter came from someone who can't see supporters");
  const added = await addNote(parsed.target, parsed.body, staff);
  refreshNotes(parsed.target);
  return added ? { ok: true } : refused("gone");
}

/**
 * The form under a note its writer may still change: saves its new text.
 * Refused for text that says nothing, a note that has gone since the page
 * loaded, whose page is then shown without it, or one past editing, as
 * after a day.
 */
export async function editNoteNow(form: FormData): Promise<FormResult<"blank" | NoteUnchanged>> {
  const staff = await requireStaff();
  const parsed = noteEditFrom(form);
  if (!parsed.ok) return parsed;
  const changed = await editNote(parsed.id, parsed.body, staff);
  if (changed === "too-late") return refused("too-late");
  if (changed === "gone") {
    refreshEveryPage();
    return refused("gone");
  }
  refreshNotes(changed);
  return { ok: true };
}

/**
 * The button under a note still young enough, for its writer or an admin:
 * deletes it. Refused for one past deleting. One that has gone already is
 * as deleted as was asked, and its page is shown without it.
 */
export async function deleteNoteNow(form: FormData): Promise<FormResult<"too-late">> {
  const staff = await requireStaff();
  const changed = await deleteNote(ownId(form), staff);
  if (changed === "too-late") return refused("too-late");
  if (changed === "gone") refreshEveryPage();
  else refreshNotes(changed);
  return { ok: true };
}
