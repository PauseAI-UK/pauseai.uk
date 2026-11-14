"use server";

// The staff interface's Server Actions. Each is a public endpoint, so each
// calls requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ImportJob, importPath, isImportJob } from "@/lib/import-runs";
import { runJob } from "@/lib/server/jobs";
import { actionRequest } from "@/lib/site-url";
import { staffBack } from "@/lib/staff-search";
import { askFrom, idFrom, noteEditFrom, noteFrom, unblockFrom } from "@/lib/staff-forms";
import { addAsk, deleteAsk, editAsk } from "@/lib/server/asks";
import { unblock } from "@/lib/server/delivery-problems";
import { isPoliticianAddress } from "@/lib/server/email";
import { setErrorDone } from "@/lib/server/errors-seen";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { decideHeldImport, isPoliticianImport } from "@/lib/politicians/imports";
import { addNote, deleteNote, editNote, type NoteTarget } from "@/lib/server/notes";
import { canSeeSupporters, requireStaff } from "@/lib/accounts/auth";

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
 * unless a run of it is going (lib/server/jobs.ts), then refreshes its
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

/**
 * Where an ask's form goes after a save: `back`, or the asks page; or the
 * form again, saying why not; or, the ask deleted meanwhile, the asks page
 * saying so, as its form is gone too.
 */
function afterAsk(slug: string, back: string, result: { saved: boolean; reason?: string }, saved: string): never {
  revalidatePath("/staff/asks");
  if (result.reason === "gone") redirect("/staff/asks?notice=gone");
  const form = slug ? `/staff/asks/${slug}/edit` : "/staff/asks/new";
  const [path, query = ""] = (result.saved ? back : form).split("?");
  const params = new URLSearchParams(query);
  params.set("notice", result.saved ? saved : result.reason!);
  if (!result.saved) params.set("back", back);
  redirect(`${path}?${params}`);
}

/** An ask's form: adds the ask, or with its slug, saves it; then goes back to where it was opened from. */
export async function saveAskNow(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const slug = String(form.get("slug") ?? "");
  const back = staffBack(String(form.get("back") ?? ""), "/staff/asks");
  const parsed = askFrom(form);
  if (!parsed) afterAsk(slug, back, { saved: false, reason: "invalid" }, "");
  afterAsk(
    slug,
    back,
    slug ? await editAsk(slug, parsed, email) : await addAsk(parsed, email),
    slug ? "saved" : "added",
  );
}

/** An ask's Delete: deletes it, while nothing refers to it, then goes to the asks page. */
export async function deleteAskNow(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const slug = String(form.get("slug") ?? "");
  afterAsk(slug, "/staff/asks", await deleteAsk(slug, email), "deleted");
}
