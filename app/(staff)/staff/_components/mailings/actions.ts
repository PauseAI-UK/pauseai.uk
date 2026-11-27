"use server";

// The Server Actions of the mailing pages. Each is a public endpoint, so
// each calls requireStaff() before anything else (tests/checks/staff-auth.test.ts).
// Each answers a result (lib/form-result.ts) or redirects. What a form or a
// component fills in itself, such as an ID, is thrown on when it isn't that,
// after requireStaff(); a mailing that's gone, or has moved on so the change
// can't be made, is a reason.
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { dueAtFrom, ownId } from "@/lib/staff-forms";
import { refused, type FormResult } from "@/lib/form-result";
import type { Params } from "@/lib/list-params";
import {
  addAttachment,
  changePicks,
  copyMailing,
  createDraft,
  deleteDraft,
  foundIds,
  getWrittenMailing,
  keepPasted,
  mailingChangesFrom,
  picksOf,
  removeAttachment,
  rescheduleMailing,
  saveDraft,
  scheduleMailing,
  sendTestCopy,
  stopMailing,
  type MailingAttachmentSummary,
  type PickChange,
} from "@/lib/mailings/drafts.server";
import { politicianAudience } from "@/lib/mailings/recipients.server";
import {
  campaignLetterChangesFrom,
  discardCampaignDraft,
  publishCampaignDraft,
  saveCampaignDraft,
} from "@/lib/mailings/campaign-letters.server";
import { campaignBySlug } from "@/lib/email-your-mp";
import { mailingAudience } from "@/lib/mailings/records.server";
import { answerLetterReply, markNothingToDo } from "@/lib/mailings/replies.server";
import { looksLikeEmail } from "@/lib/email-address";
import { requireStaff } from "@/lib/accounts/auth.server";
import { now } from "@/lib/now";
import { staffBack } from "@/lib/staff-back";
import { storedFilter } from "@/lib/staff-search";
import { sendsAt } from "@/lib/staff-time";
import { filtersPath } from "@/lib/list-params";

/**
 * Turns away a mailing to supporters: every staff member can use these
 * actions, but only those with the supporters permission its own.
 */
async function toPoliticians(id: number): Promise<void> {
  if ((await mailingAudience(id)) === "supporters") notFound();
}

/**
 * A row's ID, or a draft's version, as a component passes it: thrown when
 * it isn't one, as that's a bug in the component or a request made up,
 * never what staff typed.
 */
function own(value: unknown, what: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`A mailing's action came without its ${what}`);
  }
  return value as number;
}

/** Politicians' IDs, as a component passes them: thrown when they aren't that (own). */
function ownPoliticians(value: unknown): number[] {
  if (!Array.isArray(value)) throw new Error("A mailing's action came without its politicians");
  return value.map((one) => own(one, "politician"));
}

/** A mailing's own page. */
const pageOf = (id: number) => `/staff/mailings/${id}`;

/** What draft `id` has attached, with the version that adding or taking off a file just made of it. */
async function attachedAt(id: number, version: number) {
  return { ok: true as const, version, attachments: (await getWrittenMailing(id))!.attachments };
}

/**
 * Saves a draft's changes, if no one else has saved it since `version`.
 * Refused, the writer keeps what was typed and says so, so the page isn't
 * shown afresh.
 */
export async function saveMailing(
  id: number,
  version: number,
  changes: unknown,
): Promise<FormResult<"conflict" | "not-draft" | "gone", { version: number }>> {
  await requireStaff();
  await toPoliticians(own(id, "ID"));
  const parsed = mailingChangesFrom(changes);
  if (!parsed) throw new Error("A draft's save came with changes that aren't a mailing's");
  const result = await saveDraft(id, own(version, "version"), parsed);
  return result.saved ? { ok: true, version: result.version } : refused(result.reason);
}

/** Attaches the form's file to a draft at its version. */
export async function attachToMailing(
  form: FormData,
): Promise<
  FormResult<
    "conflict" | "not-draft" | "gone" | "too-big",
    { version: number; attachments: MailingAttachmentSummary[] }
  >
> {
  await requireStaff();
  const id = ownId(form);
  const version = ownId(form, "version");
  const file = form.get("file");
  if (!(file instanceof File) || !file.name) throw new Error("A draft's new file came without the file");
  await toPoliticians(id);
  const result = await addAttachment(id, version, {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    content: Buffer.from(await file.arrayBuffer()),
  });
  return result.saved ? attachedAt(id, result.version) : refused(result.reason);
}

/** Takes a file off a draft at its version. */
export async function detachFromMailing(
  id: number,
  version: number,
  attachmentId: number,
): Promise<
  FormResult<"conflict" | "not-draft" | "gone", { version: number; attachments: MailingAttachmentSummary[] }>
> {
  await requireStaff();
  await toPoliticians(own(id, "ID"));
  const result = await removeAttachment(id, own(version, "version"), own(attachmentId, "file"));
  return result.saved ? attachedAt(id, result.version) : refused(result.reason);
}

/**
 * Sends one recipient's email of a draft, as they'd get it, to `to`, or
 * with none the staff member, and says where it went. Refused for a draft
 * that's gone, for a politician who's no longer one of its recipients, and
 * when the email couldn't be sent; for the first two its page is shown
 * afresh. The page sends only an address that looks like one, so one that
 * doesn't is thrown on.
 */
export async function sendMailingTest(
  id: number,
  politicianId: number,
  to = "",
): Promise<FormResult<"gone" | "not-recipient" | "not-sent", { to: string }>> {
  const { email } = await requireStaff();
  own(id, "ID");
  own(politicianId, "politician");
  const address = to.trim() || email;
  if (!looksLikeEmail(address)) throw new Error("A test copy came with an address that doesn't look like one");
  const mailing = await getWrittenMailing(id);
  const recipient = mailing && (await politicianAudience(mailing.filter)).recipients.find((r) => r.id === politicianId);
  if (!mailing || !recipient) {
    revalidatePath(pageOf(id));
    return refused(mailing ? "not-recipient" : "gone");
  }
  const result = await sendTestCopy(mailing, recipient, address);
  return result.sent ? { ok: true, to: address } : refused("not-sent");
}

/**
 * Schedules a draft at its version, if nothing stops it. Refused as a save
 * is, or for "problems": something the page checks too, changed since it
 * loaded, which the page, shown afresh, then says.
 */
export async function scheduleMailingNow(
  id: number,
  version: number,
): Promise<FormResult<"conflict" | "not-draft" | "gone" | "problems">> {
  const { email } = await requireStaff();
  await toPoliticians(own(id, "ID"));
  const result = await scheduleMailing(id, own(version, "version"), email);
  revalidatePath("/staff/mailings");
  if (result.scheduled) return { ok: true };
  return refused("reason" in result ? result.reason : "problems");
}

/**
 * Deletes the form's draft, then goes to the list of mailings. One that's
 * gone already is as deleted as was asked; one someone has scheduled since
 * is refused, and its page shown afresh.
 */
export async function deleteMailingDraft(form: FormData): Promise<FormResult<"not-draft">> {
  const { email } = await requireStaff();
  const id = ownId(form);
  await toPoliticians(id);
  const deleted = await deleteDraft(id, email);
  revalidatePath("/staff/mailings");
  if (!deleted && (await mailingAudience(id))) {
    revalidatePath(pageOf(id));
    revalidatePath("/staff/politicians");
    return refused("not-draft");
  }
  redirect("/staff/mailings");
}

/**
 * Stops the form's mailing: a scheduled one becomes a draft again; one
 * sending sends no more. Refused for one that's neither any more, or gone.
 */
export async function stopMailingNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff();
  const id = ownId(form);
  await toPoliticians(id);
  const stopped = await stopMailing(id, email);
  revalidatePath("/staff/mailings");
  revalidatePath(pageOf(id));
  return stopped ? { ok: true } : refused("gone");
}

/**
 * Changes when the form's scheduled mailing goes: its day and hour, in
 * London, which the form's own controls choose, so thrown when they're not
 * a time. Refused for a time that has passed, as one can while the form
 * stays open, and for a mailing no longer scheduled, or gone.
 */
export async function rescheduleMailingNow(form: FormData): Promise<FormResult<"too-soon" | "gone">> {
  const { email } = await requireStaff();
  const id = ownId(form);
  const dueAt = dueAtFrom(form);
  if (!dueAt) throw new Error("A mailing's new time came as none the form offers");
  await toPoliticians(id);
  if (sendsAt(dueAt) <= now()) return refused("too-soon");
  const changed = await rescheduleMailing(id, dueAt, email);
  revalidatePath("/staff/mailings");
  revalidatePath(pageOf(id));
  return changed ? { ok: true } : refused("gone");
}

/** The form's fields but `skip`, as the politicians list's parameters. */
function formParams(form: FormData, skip: string[]): Params {
  const params: Record<string, string[]> = {};
  for (const [name, value] of form.entries()) {
    if (typeof value === "string" && !skip.includes(name)) (params[name] ??= []).push(value);
  }
  return params;
}

/**
 * Makes a new mailing, a draft. From the list with a filter, with its
 * fields and `found`, it starts with everyone the filter finds ticked, on
 * that filter, and opens the politicians list choosing who it's for; from
 * the list with none, or the list of mailings, with no one, and opens the
 * draft, to choose its ask first.
 */
export async function newMailing(form: FormData): Promise<never> {
  const { email } = await requireStaff();
  const found = form.has("found");
  const params = storedFilter("politicians", formParams(form, ["found"])).params;
  const picks = found ? picksOf(await foundIds(params), params) : picksOf([]);
  const { id } = await createDraft(email, picks, {});
  revalidatePath("/staff/mailings");
  redirect(found ? filtersPath("/staff/politicians", params, { mailing: String(id) }) : pageOf(id));
}

/**
 * Copy mailing, on a mailing's page: makes a draft that copies the form's
 * mailing (copyMailing), and opens it. Refused for one that's gone, and its
 * page shown afresh.
 */
export async function copyMailingNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff();
  const id = ownId(form);
  const copy = await copyMailing(id, email);
  if (!copy) {
    revalidatePath(pageOf(id));
    return refused("gone");
  }
  revalidatePath("/staff/mailings");
  redirect(pageOf(copy));
}

/**
 * Changes who's ticked for draft `mailing`, and shows `path` afresh.
 * Refused for one that's gone, or no longer a draft.
 */
async function pick(mailing: number, change: PickChange, path: string): Promise<FormResult<"gone">> {
  const changed = await changePicks(mailing, change);
  revalidatePath(path);
  return changed ? { ok: true } : refused("gone");
}

/** Ticks a politician for a draft, or unticks them. */
export async function pickPolitician(
  mailing: number,
  politician: number,
  ticked: boolean,
): Promise<FormResult<"gone">> {
  await requireStaff();
  await toPoliticians(own(mailing, "ID"));
  const one = [own(politician, "politician")];
  return pick(mailing, ticked ? { tick: one } : { untick: one }, "/staff/politicians");
}

/** Ticks everyone the politicians list's `params` find for a draft, on every page, or unticks them. */
export async function pickFound(mailing: number, params: Params, ticked: boolean): Promise<FormResult<"gone">> {
  await requireStaff();
  await toPoliticians(own(mailing, "ID"));
  if (typeof params !== "object" || params === null) throw new Error("A mailing's action came without its filters");
  return pick(mailing, ticked ? { found: params } : { untick: await foundIds(params) }, "/staff/politicians");
}

/** Unticks everyone for a draft, to start again: bound to its ID, for a form or a tick box. */
export async function untickAll(mailing: number): Promise<FormResult<"gone">> {
  await requireStaff();
  await toPoliticians(own(mailing, "ID"));
  return pick(mailing, { clear: true }, "/staff/politicians");
}

/**
 * Looks for who each line of the form's names is, for the draft the list on
 * `back` is choosing for, and keeps that with the draft; then goes to the
 * list's paste tab, to show who each found, unticked till they're ticked
 * there. The form's on a list that's choosing for a draft, so thrown without
 * the names or the draft. Refused for a draft that's gone, or no longer one,
 * and the list shown afresh.
 */
export async function pasteNames(form: FormData): Promise<FormResult<"gone">> {
  await requireStaff();
  const text = form.get("names");
  const back = staffBack(String(form.get("back") ?? ""), "/staff/politicians");
  if (typeof text !== "string") throw new Error("Paste names came without the names");
  const url = new URL(back, "http://staff");
  const mailing = Number(url.searchParams.get("mailing"));
  if (!Number.isSafeInteger(mailing) || mailing < 1) throw new Error("Paste names came without the draft it's for");
  const lines = text
    .split(/\r?\n/)
    .map((one) => one.trim())
    .filter(Boolean);
  if (!(await keepPasted(mailing, lines))) {
    revalidatePath("/staff/politicians");
    return refused("gone");
  }
  url.searchParams.set("tab", "pasted");
  redirect(`${url.pathname}${url.search}`);
}

/** Leave them out, under a draft's warning: unticks these politicians for it, such as those who already answered its ask. */
export async function leaveOutOfMailing(mailing: number, politicians: number[]): Promise<FormResult<"gone">> {
  await requireStaff();
  await toPoliticians(own(mailing, "ID"));
  return pick(mailing, { untick: ownPoliticians(politicians) }, pageOf(mailing));
}

/** Ticks these politicians for a draft, or unticks them: everyone a paste found, from the box over them. */
export async function pickMany(mailing: number, politicians: number[], ticked: boolean): Promise<FormResult<"gone">> {
  await requireStaff();
  await toPoliticians(own(mailing, "ID"));
  const them = ownPoliticians(politicians);
  return pick(mailing, ticked ? { tick: them } : { untick: them }, "/staff/politicians");
}

/**
 * Nothing to do, under a politician's reply to a mailing's letter: marks it,
 * and those before it, as needing nothing, as the staff member; then the
 * mailing's pages are shown afresh. Refused for a reply someone has dealt
 * with since the page loaded, or that's gone.
 */
export async function nothingToDoNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff();
  const marked = await markNothingToDo(ownId(form, "replyId"), email);
  revalidatePath("/staff/mailings", "layout");
  return marked ? { ok: true } : refused("gone");
}

/** A draft's own ID, as the page makes it: a UUID. */
const DRAFT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Send reply, under a politician's reply to a mailing's letter: sends the
 * staff member's answer, once for the page's `draftId`, and shows the
 * mailing's pages afresh once it's gone; says whether it went, or why not.
 * One that didn't go leaves the page as it is, with what was typed.
 */
export async function answerLetterReplyNow(
  replyId: number,
  draftId: string,
  body: unknown,
): Promise<FormResult<"blank" | "gone" | "blocked" | "failed" | "window">> {
  const { email } = await requireStaff();
  own(replyId, "reply");
  if (!DRAFT_ID.test(draftId)) throw new Error("An answer to a reply came without its draft's ID");
  const result = await answerLetterReply(replyId, draftId, body, email);
  if (!result.sent) return refused(result.reason);
  revalidatePath("/staff/mailings", "layout");
  return { ok: true };
}

/** A campaign in the code, by its slug, as its letter's page passes it: thrown when it isn't one (own). */
function ownCampaign(slug: unknown): string {
  if (typeof slug !== "string" || !campaignBySlug(slug))
    throw new Error("A campaign letter's action came without its campaign");
  return slug;
}

/** Saves the changes to a campaign's draft letter, if no one else has saved it since `version`. */
export async function saveCampaignLetter(
  id: number,
  version: number,
  changes: unknown,
): Promise<FormResult<"conflict" | "not-draft" | "gone", { version: number }>> {
  const { email } = await requireStaff("supporters");
  const parsed = campaignLetterChangesFrom(changes);
  if (!parsed) throw new Error("A campaign letter's save came with changes that aren't a letter's");
  const result = await saveCampaignDraft(own(id, "ID"), own(version, "version"), parsed, email);
  return result.saved ? { ok: true, version: result.version } : refused(result.reason);
}

/**
 * Publishes campaign `slug`'s draft at `version`, so supporters start from
 * it, then goes to the campaign's page. Refused if it's been saved since,
 * published or discarded, or has no subject or letter.
 */
export async function publishCampaignLetter(
  slug: string,
  id: number,
  version: number,
): Promise<FormResult<"conflict" | "not-draft" | "gone" | "no-subject" | "no-letter">> {
  const { email } = await requireStaff("supporters");
  const campaign = ownCampaign(slug);
  const result = await publishCampaignDraft(own(id, "ID"), own(version, "version"), email);
  if (!result.saved) return refused(result.reason);
  revalidatePath(`/staff/campaigns/${campaign}`);
  redirect(`/staff/campaigns/${campaign}`);
}

/** Throws away campaign `slug`'s draft letter, the form's `id`, then goes to the campaign's page. */
export async function discardCampaignLetter(slug: string, form: FormData): Promise<FormResult<never>> {
  await requireStaff("supporters");
  const campaign = ownCampaign(slug);
  await discardCampaignDraft(ownId(form));
  revalidatePath(`/staff/campaigns/${campaign}`);
  redirect(`/staff/campaigns/${campaign}`);
}
