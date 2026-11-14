"use server";

// The staff interface's Server Actions. Each is a public endpoint, so each
// calls requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { type ImportJob, importPath, isImportJob } from "@/lib/import-runs";
import { runJob } from "@/lib/server/jobs";
import { actionRequest } from "@/lib/site-url";
import { now } from "@/lib/now";
import { erasedPath, staffBack } from "@/lib/staff-search";
import {
  askFrom,
  eraseFrom,
  eventFrom,
  idFrom,
  noteEditFrom,
  noteFrom,
  permissionsFrom,
  statusFrom,
  unblockFrom,
} from "@/lib/staff-forms";
import { chosen, optOutChoices } from "@/lib/opt-out-choices";
import { offCalendarAfter } from "@/lib/server/email-settings";
import { recordStaffOptOut } from "@/lib/server/opt-outs";
import { getSupporter } from "@/lib/server/supporters";
import { addAsk, deleteAsk, editAsk } from "@/lib/server/asks";
import { unblock } from "@/lib/server/delivery-problems";
import { isPoliticianAddress } from "@/lib/server/email";
import { setErrorDone } from "@/lib/server/errors-seen";
import { disconnectGmail } from "@/lib/server/gmail-accounts";
import { ERRORS_LIST } from "@/lib/staff-lists";
import { eraseSupporter } from "@/lib/server/erasure";
import { decideHeldImport, isPoliticianImport } from "@/lib/server/politician-import";
import { editPoliticianDetails, type EditResult, isMark, setMark } from "@/lib/server/politician-edits";
import { addNote, deleteNote, editNote, type NoteTarget } from "@/lib/server/notes";
import { setStatus } from "@/lib/server/politicians";
import { type AddResult, addPoliticianAddress, removePoliticianAddress } from "@/lib/server/politician-aliases";
import { canSeeSupporters, requireStaff } from "@/lib/server/staff-auth";
import { type EventSaved, setEventDoc, setEventOwner } from "@/lib/server/staff-events";
import {
  type AccountChange,
  endStaffSessions,
  removeStaffAccount,
  saveStaffAccount,
} from "@/lib/server/staff-accounts";

/** The form on a politician's page: sets their answer to an ask, dated today, or clears it, with its note of how we know. */
export async function setAskStatus(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const parsed = statusFrom(form);
  if (!parsed) return;
  const today = now().toISOString().slice(0, 10);
  await setStatus(
    parsed.politicianId,
    parsed.ask,
    { status: parsed.status, date: parsed.status ? today : null, note: parsed.note },
    email,
  );
  revalidatePath("/staff/politicians");
  revalidatePath(`/staff/politicians/${parsed.politicianId}`);
  // A mailing's counts, and its letters' pages, where the answer can be set too.
  revalidatePath("/staff/mailings", "layout");
}

/**
 * An event's edit form on the events page: makes the staff member chosen
 * its owner, which emails them and the owner before, and sets or clears its
 * Google Doc. Any staff member can. Returns whom it emailed, and the new
 * owner, for the page to say so.
 */
export async function saveEventNow(form: FormData): Promise<EventSaved> {
  const { email } = await requireStaff();
  const parsed = eventFrom(form);
  if (!parsed) return { emailed: [], owner: null };
  const emailed = parsed.owner ? await setEventOwner(parsed.eventId, parsed.owner, email) : undefined;
  const doc = await setEventDoc(parsed.eventId, parsed.doc, email);
  if (emailed || doc) revalidatePath("/staff/events");
  return { emailed: emailed ?? [], owner: parsed.owner };
}

/** A marker's button in a politician's band: turns it on or off. */
export async function setMarkNow(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const id = idFrom(form, "politicianId");
  const mark = String(form.get("mark") ?? "");
  if (!id || !isMark(mark)) return;
  await setMark(id, mark, form.get("on") === "true", email);
  revalidatePath(`/staff/politicians/${id}`);
  revalidatePath("/staff/politicians");
}

/** The form of a politician's details: saves what staff changed, saying whether it did, or why not. */
export async function editPoliticianNow(form: FormData): Promise<EditResult | undefined> {
  const { email } = await requireStaff();
  const id = idFrom(form, "politicianId");
  if (!id) return undefined;
  const given = form.get("email");
  const result = await editPoliticianDetails(
    id,
    {
      salutation: String(form.get("salutation") ?? ""),
      ...(given === null ? {} : { email: String(given) }),
    },
    email,
  );
  if (result.saved) revalidatePath("/staff", "layout");
  return result;
}

/**
 * The form in a supporter's consents: records that they opted out of what
 * staff chose, at one of their addresses or numbers, with how they said so;
 * events by email, or every bulk email, takes them off our Luma calendar too.
 * Says whether it was new; false for a choice not theirs, or no how.
 */
export async function recordOptOutNow(form: FormData): Promise<boolean> {
  const { email } = await requireStaff("supporters");
  const id = idFrom(form, "supporterId");
  const how = String(form.get("how") ?? "").trim();
  const supporter = id ? await getSupporter(id) : undefined;
  const choice = supporter && chosen(form.get("choice"), optOutChoices(supporter.permissions));
  if (!choice || !how) return false;
  const recorded = await recordStaffOptOut(choice, email, { how });
  if (recorded) await offCalendarAfter([{ ...choice, source: "staff" }]);
  revalidatePath(`/staff/supporters/${id}`);
  return recorded;
}

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
 * The form in a politician's aliases: adds an address to theirs, as the
 * staff member, keeping the mail with it the mailboxes hold. Says what
 * happened, for the form to show.
 */
export async function addAliasNow(form: FormData): Promise<AddResult | undefined> {
  const { email } = await requireStaff();
  const politicianId = idFrom(form, "politicianId");
  if (!politicianId) return undefined;
  const result = await addPoliticianAddress(politicianId, String(form.get("address") ?? ""), email);
  // Their page, and any thread's, which can now show them.
  if (result.added) revalidatePath("/staff", "layout");
  return result;
}

/** The button by an address staff added to a politician's: removes it. */
export async function removeAliasNow(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const politicianId = idFrom(form, "politicianId");
  if (politicianId && (await removePoliticianAddress(politicianId, String(form.get("address") ?? ""), email)))
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

/** Where the accounts page goes after a change: back to itself, saying why if the change was refused. */
function accountsPage(change: AccountChange | "removed"): never {
  revalidatePath("/staff/accounts");
  redirect(change === "changed" || change === "unchanged" ? "/staff/accounts" : `/staff/accounts?notice=${change}`);
}

/**
 * The accounts page: gives an address an account with exactly the
 * permissions in the form, adding it if it has none, as the admin. A
 * change refused (the last admin, an address not at pauseai.uk) is said on
 * the page.
 */
export async function saveStaffAccountNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("admin");
  const parsed = permissionsFrom(form);
  if (!parsed) return;
  accountsPage(await saveStaffAccount(parsed.email, parsed.permissions, email));
}

/** The accounts page: removes an account, ending its sessions, and says what that leaves them. */
export async function removeStaffAccountNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("admin");
  const parsed = permissionsFrom(form);
  if (!parsed) return;
  const change = await removeStaffAccount(parsed.email, email);
  accountsPage(change === "changed" ? "removed" : change);
}

/** The accounts page: ends every session of an account, as the admin; their own included, which logs them out. */
export async function endStaffSessionsNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("admin");
  const parsed = permissionsFrom(form);
  if (!parsed) return;
  await endStaffSessions(parsed.email, email);
  accountsPage("changed");
}

/**
 * Erases a supporter, from their page, then goes to the list, which says
 * so, and what couldn't be cleared afterwards, if anything. A supporter
 * that's already gone is nothing to do.
 */
export async function eraseSupporterNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("supporters");
  const parsed = eraseFrom(form);
  if (!parsed) return;
  const result = await eraseSupporter(parsed.id, parsed.reference, email);
  if (!result) return;
  revalidatePath("/staff", "layout");
  redirect(erasedPath(result.notCleared));
}

/** Disconnects your own Gmail, from your page, going back to it saying so, in place of how connecting went. */
export async function disconnectMyGmail(): Promise<void> {
  const { email } = await requireStaff();
  await disconnectGmail(email, email);
  revalidatePath("/staff/me");
  redirect("/staff/me?gmail=disconnected");
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
