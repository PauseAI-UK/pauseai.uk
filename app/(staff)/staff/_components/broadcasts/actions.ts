"use server";

// The Server Actions of the pages of broadcasts to supporters. Each is a public
// endpoint, so each calls requireStaff() before anything else
// (tests/checks/staff-auth.test.ts), and asks for the supporters permission,
// as a broadcast is to someone who said yes to it.
import { revalidatePath } from "next/cache";
import { dealWithReply, type ReplyDecision } from "@/lib/broadcasts/replies.server";
import { answerReply, type AnswerResult } from "@/lib/broadcasts/answers.server";
import { redirect } from "next/navigation";
import { looksLikeEmail } from "@/lib/email-your-mp";
import { fakeRecipient } from "@/lib/broadcasts/broadcasts";
import { addAttachment, deleteDraft, removeAttachment, rescheduleMailing } from "@/lib/mailings/drafts.server";
import {
  changeBroadcastConsent,
  changeBroadcastFilter,
  createBroadcastDraft,
  getWrittenBroadcast,
  broadcastChangesFrom,
  resumeBroadcast,
  saveBroadcastDraft,
  scheduleBroadcast,
  sendBroadcastTest,
  stopBroadcast,
  submitTemplate,
  withdrawTemplate,
  type BroadcastScheduleResult,
  type TemplateSubmitResult,
} from "@/lib/broadcasts/drafts.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import type { SaveResult } from "@/lib/mailings/drafts.server";
import { dueAtFrom, idFrom } from "@/lib/staff-forms";
import { storedFilter } from "@/lib/staff-search";
import { filtersPath, type Params } from "@/lib/list-params";

const LIST = "/staff/broadcasts";

/** The form's fields, as the supporters list's parameters that choose who. */
function whoFrom(form: FormData): Params {
  const params: Record<string, string[]> = {};
  for (const [name, value] of form.entries()) {
    if (typeof value === "string") (params[name] ??= []).push(value);
  }
  return storedFilter("supporters", params).params;
}

/**
 * Makes a draft to everyone the form's filter finds, and opens it; with no
 * Consent filter answered yes, back to the list.
 */
export async function newBroadcast(form: FormData): Promise<void> {
  const { email } = await requireStaff("supporters");
  const params = whoFrom(form);
  const id = await createBroadcastDraft(email, params);
  if (!id) redirect(filtersPath("/staff/supporters", params));
  revalidatePath(LIST);
  redirect(`${LIST}/${id}`);
}

/**
 * Makes a draft to everyone who said yes to `consent`, topics answered
 * yes, as New broadcast's Consent is chosen, and opens it; with none, stays.
 */
export async function newBroadcastWith(consent: string): Promise<void> {
  const { email } = await requireStaff("supporters");
  const id = await createBroadcastDraft(email, { contact: consent.split(" ") });
  if (!id) return;
  revalidatePath(LIST);
  redirect(`${LIST}/${id}`);
}

/** Changes the Consent draft `id` goes under, as its writer's dropdown is changed; says whether it did. */
export async function changeBroadcastConsentNow(id: number, consent: string): Promise<boolean> {
  const { email } = await requireStaff("supporters");
  const changed = await changeBroadcastConsent(id, consent, email);
  if (changed) revalidatePath(`${LIST}/${id}`);
  return changed;
}

/**
 * A reply's buttons on its Thread: records it as an opt-out, of what its
 * email went under or of all bulk email, or as nothing to do, as the staff
 * member; then its page is shown afresh.
 */
export async function dealWithReplyNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("supporters");
  const replyId = idFrom(form, "replyId");
  const decision = String(form.get("decision"));
  if (!replyId || !["topics", "bulk", "nothing"].includes(decision)) return;
  if (await dealWithReply(replyId, decision as ReplyDecision, email)) revalidatePath(LIST, "layout");
}

/** A draft's own ID, as the page makes it: a UUID. */
const DRAFT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Send reply on a reply's Thread: sends the staff member's answer, once for
 * the page's `draftId`, and shows the page afresh once it's gone; says
 * whether it went, or why not.
 */
export async function answerReplyNow(replyId: number, draftId: string, body: unknown): Promise<AnswerResult> {
  const { email } = await requireStaff("supporters");
  if (!Number.isSafeInteger(replyId) || !DRAFT_ID.test(draftId)) return { sent: false, reason: "gone" };
  const result = await answerReply(replyId, draftId, body, email);
  if (result.sent) revalidatePath(LIST, "layout");
  return result;
}

/** Keeps the form's filter for draft `id`, and goes back to it. */
export async function keepFilterForBroadcast(id: number, form: FormData): Promise<void> {
  await requireStaff("supporters");
  await changeBroadcastFilter(id, whoFrom(form));
  revalidatePath(`${LIST}/${id}`);
  redirect(`${LIST}/${id}`);
}

/** Saves a draft's changes, if no one else has saved it since `version`. */
export async function saveBroadcast(id: number, version: number, changes: unknown): Promise<SaveResult | undefined> {
  await requireStaff("supporters");
  const broadcast = await getWrittenBroadcast(id);
  const parsed = broadcast && broadcastChangesFrom(changes, broadcast.channel);
  return parsed && saveBroadcastDraft(broadcast!, version, parsed);
}

/** Attaches the form's file to a draft email at its version. */
export async function attachToBroadcast(form: FormData) {
  await requireStaff("supporters");
  const id = idFrom(form);
  const version = idFrom(form, "version");
  const file = form.get("file");
  if (!id || !version || !(file instanceof File) || !file.name) return undefined;
  if (!(await getWrittenBroadcast(id))) return undefined;
  const saved = await addAttachment(id, version, {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    content: Buffer.from(await file.arrayBuffer()),
  });
  return { ...saved, attachments: (await getWrittenBroadcast(id))!.attachments };
}

/** Takes a file off a draft email at its version. */
export async function detachFromBroadcast(id: number, version: number, attachmentId: number) {
  await requireStaff("supporters");
  if (!(await getWrittenBroadcast(id))) return { saved: false as const, reason: "gone" as const, attachments: [] };
  const saved = await removeAttachment(id, version, attachmentId);
  return { ...saved, attachments: (await getWrittenBroadcast(id))!.attachments };
}

/**
 * Sends one recipient's copy of a draft, as they'd get it, to `to`, or with
 * none the staff member's address, for an email, and says where it went.
 */
export async function sendBroadcastTestNow(id: number, meets: unknown, to = "") {
  const { email } = await requireStaff("supporters");
  const broadcast = await getWrittenBroadcast(id);
  if (!broadcast || !Array.isArray(meets) || !meets.every((one) => typeof one === "string")) return undefined;
  const address = to.trim() || (broadcast.channel === "email" ? email : "");
  if (broadcast.channel === "email" ? !looksLikeEmail(address) : !address) return undefined;
  // Filled in for someone made up, as the preview shows, never a real supporter.
  const result = await sendBroadcastTest(broadcast, fakeRecipient(meets, broadcast.channel), address);
  return result && { ...result, to: address };
}

/** Schedules a draft at its version, if nothing stops it. */
export async function scheduleBroadcastNow(id: number, version: number): Promise<BroadcastScheduleResult> {
  const { email } = await requireStaff("supporters");
  const result = await scheduleBroadcast(id, version, email);
  revalidatePath(LIST);
  return result;
}

/** Sends draft text `id`'s new words to WhatsApp for approval, after what's typed is saved. */
export async function submitTemplateNow(id: number): Promise<TemplateSubmitResult> {
  const { email } = await requireStaff("supporters");
  const result = await submitTemplate(id, email);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
  return result;
}

/** Takes draft text `id`'s words back from WhatsApp's review, so they can be changed; says whether it did. */
export async function withdrawTemplateNow(id: number): Promise<boolean> {
  const { email } = await requireStaff("supporters");
  const withdrawn = await withdrawTemplate(id, email);
  revalidatePath(`${LIST}/${id}`);
  return withdrawn;
}

/** Deletes the form's draft, then goes to the list of broadcasts. */
export async function deleteBroadcastDraft(form: FormData): Promise<void> {
  const { email } = await requireStaff("supporters");
  const id = idFrom(form);
  if (id && (await getWrittenBroadcast(id))) await deleteDraft(id, email);
  revalidatePath(LIST);
  redirect(LIST);
}

/** Stops the form's broadcast: a scheduled one becomes a draft again; one sending sends no more. */
export async function stopBroadcastNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("supporters");
  const id = idFrom(form);
  if (!id) return;
  await stopBroadcast(id, email);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
}

/** Sets the form's broadcast going again, if it stopped as it hadn't all gone in time. */
export async function resumeBroadcastNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("supporters");
  const id = idFrom(form);
  if (!id) return;
  await resumeBroadcast(id, email);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
}

/** Changes when the form's scheduled broadcast goes: its day and hour, in London. */
export async function rescheduleBroadcastNow(form: FormData): Promise<void> {
  const { email } = await requireStaff("supporters");
  const id = idFrom(form);
  const dueAt = dueAtFrom(form);
  if (!id || !dueAt) return;
  if (!(await getWrittenBroadcast(id))) return;
  await rescheduleMailing(id, dueAt, email);
  revalidatePath(LIST);
  revalidatePath(`${LIST}/${id}`);
}
