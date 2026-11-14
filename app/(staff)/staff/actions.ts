"use server";

// The staff interface's Server Actions. Each is a public endpoint, so each
// calls requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ImportJob, importPath, isImportJob } from "@/lib/import-runs";
import { runJob } from "@/lib/server/jobs.server";
import { actionRequest } from "@/lib/site-url.server";
import { idFrom, noteEditFrom, noteFrom, unblockFrom } from "@/lib/staff-forms";
import { unblock } from "@/lib/server/delivery-problems.server";
import { isPoliticianAddress } from "@/lib/server/email.server";
import { setErrorDone } from "@/lib/server/errors-seen.server";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { decideHeldImport, isPoliticianImport } from "@/lib/politicians/imports.server";
import { addNote, deleteNote, editNote, type NoteTarget } from "@/lib/server/notes.server";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth.server";

/** Refreshes the page of whom a note is about. */
function refreshNotes(target: NoteTarget): void {
  revalidatePath(
    "supporterId" in target ? `/staff/supporters/${target.supporterId}` : `/staff/politicians/${target.politicianId}`,
  );
}

/** The form under the notes on a supporter's or a politician's page: adds one, as the staff member. */
export async function addNoteNow(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const parsed = noteFrom(form);
  if (parsed && (await addNote(parsed.target, parsed.body, staff))) refreshNotes(parsed.target);
}

/** The form under a note its writer may still change: saves its new text; false if it can't, as after a day. */
export async function editNoteNow(form: FormData): Promise<boolean> {
  const staff = await requireStaff();
  const parsed = noteEditFrom(form);
  const target = parsed && (await editNote(parsed.id, parsed.body, staff));
  if (target) refreshNotes(target);
  return Boolean(target);
}

/** The button under a note still young enough, for its writer or an admin: deletes it; false if it can't. */
export async function deleteNoteNow(form: FormData): Promise<boolean> {
  const staff = await requireStaff();
  const id = idFrom(form);
  const target = id && (await deleteNote(id, staff));
  if (target) refreshNotes(target);
  return Boolean(target);
}

/** Refreshes the pages that show a job's runs: its own, the overview of every job, and the home page's actions. */
function refreshImport(job: ImportJob): void {
  revalidatePath(importPath(job));
  revalidatePath("/staff/scheduled-jobs");
  revalidatePath("/staff");
}

/**
 * A job's button, bound to the job's name: runs it as the staff member,
 * unless a run of it is going (lib/server/jobs.server.ts), then refreshes its
 * pages. Any staff member may run any job. A failure is in the import log,
 * shown on its page like a scheduled one, so it's logged rather than
 * crashing the page.
 */
export async function runJobNow(job: string): Promise<void> {
  const { email } = await requireStaff();
  if (!isImportJob(job)) return;
  try {
    await runJob(job, email, await actionRequest());
  } catch (error) {
    console.error(error);
  }
  refreshImport(job);
}

/** Applies or discards a held import of a body's members, from its job's page. */
export async function decideImport(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const id = idFrom(form);
  const decision = form.get("decision");
  const job = String(form.get("job") ?? "");
  if (!id || (decision !== "apply" && decision !== "discard") || !isPoliticianImport(job)) return;
  await decideHeldImport(id, decision, email);
  refreshImport(job);
}

/**
 * Unblocks an address, on either page of blocked addresses or a politician's.
 * Any address but a politician's needs `supporters`, as its page does. If
 * the provider can't be reached, it's logged and the address stays blocked.
 */
export async function unblockAddress(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const parsed = unblockFrom(form);
  if (!parsed) return;
  if (!canSeeSupporters(staff) && !(await isPoliticianAddress(parsed.address))) return;
  try {
    await unblock(parsed.address, staff.email, parsed.note);
  } catch (error) {
    console.error(error);
  }
  // The addresses page, the politicians list and their pages all show it.
  revalidatePath("/staff", "layout");
}

/**
 * The button on an error's page: marks it done, as the admin, with `done`
 * "yes", and goes back to the list for the next; or to do again without,
 * staying on its page.
 */
export async function setErrorDoneNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("admin");
  const id = idFrom(form);
  if (!id) return;
  const done = form.get("done") === "yes";
  await setErrorDone(id, done ? email : null);
  // Its page, and both tabs of the list.
  revalidatePath(ERRORS_LIST.path, "layout");
  if (done) redirect(ERRORS_LIST.path);
}
