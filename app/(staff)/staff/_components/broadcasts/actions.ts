"use server";

// The Server Actions of the pages of broadcasts to supporters. Each is a public
// endpoint, so each calls requireStaff() before anything else
// (tests/checks/staff-auth.test.ts), and asks for the supporters permission,
// as a broadcast is to someone who said yes to it. Each answers a result
// (lib/form-result.ts) or redirects. What a form or a component fills in
// itself, an ID or a fixed choice, is thrown on when it isn't that, after
// requireStaff(); a broadcast that's gone, or has moved on so the change
// can't be made, is a reason.
import { revalidatePath } from "next/cache";
import { dealWithReply, type ReplyDecision } from "@/lib/broadcasts/replies.server";
import { answerReply, reactToReply, type ReactionResult } from "@/lib/broadcasts/answers.server";
import type { AnswerResult } from "@/lib/mailings/answers";
import { redirect } from "next/navigation";
import { looksLikeEmail } from "@/lib/email-address";
import { choiceTerms, fakeRecipient, finishFits, finishKept, REACTIONS } from "@/lib/broadcasts/broadcasts";
import {
  addAttachment,
  deleteDraft,
  removeAttachment,
  type MailingAttachmentSummary,
  type SaveResult,
} from "@/lib/mailings/drafts.server";
import {
  changeBroadcastConsent,
  changeBroadcastFilter,
  copyBroadcast,
  createBroadcastDraft,
  deleteApprovedTemplate,
  getWrittenBroadcast,
  broadcastChangesFrom,
  resumeBroadcast,
  retimeBroadcast,
  saveBroadcastDraft,
  scheduleBroadcast,
  sendBroadcastTest,
  stopBroadcast,
  submitTemplate,
  withdrawTemplate,
  type BroadcastScheduled,
  type TemplateDeleteResult,
  type TemplateRefusal,
  type TemplateTaken,
} from "@/lib/broadcasts/drafts.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import type { LinkCard } from "@/lib/broadcasts/link-card";
import { linkCard } from "@/lib/server/outside-services/link-pages.server";
import { refused, type FormResult } from "@/lib/form-result";
import { dueAtFrom, ownId } from "@/lib/staff-forms";
import { findPlaces } from "@/lib/broadcasts/places.server";
import type { Place } from "@/lib/broadcasts/places";
import { storedFilter } from "@/lib/staff-search";
import { filtersPath, type Params } from "@/lib/list-params";

const LIST = "/staff/broadcasts";

/** A broadcast's own page. */
const pageOf = (id: number) => `${LIST}/${id}`;

/** Why a draft wasn't saved at a version: someone else saved since, it's no longer a draft, or it's gone (SaveResult). */
type SaveRefusal = Exclude<SaveResult, { saved: true }>["reason"];

/** A draft's version and files, after one is attached or taken off. */
type Files = { version: number; attachments: MailingAttachmentSummary[] };

/**
 * A row's ID or a draft's version, which a component passes: thrown when it
 * isn't one, as that's a bug in the component or a request made up.
 */
function ownNumber(value: unknown, what: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1) {
    throw new Error(`A broadcast's action came without ${what}`);
  }
  return value as number;
}

/** A save's result, as a form's. */
function saved(result: SaveResult): FormResult<SaveRefusal, { version: number }> {
  return result.saved ? { ok: true, version: result.version } : refused(result.reason);
}

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
export async function newBroadcast(form: FormData): Promise<never> {
  const { email } = await requireStaff("supporters");
  const params = whoFrom(form);
  const id = await createBroadcastDraft(email, params);
  if (!id) redirect(filtersPath("/staff/supporters", params));
  revalidatePath(LIST);
  redirect(pageOf(id));
}

/**
 * Makes a draft to everyone who said yes to `consent`, topics answered
 * yes, as New broadcast's Consent is chosen, and opens it. The Consent is
 * one of the writer's own, so thrown when it's none.
 */
export async function newBroadcastWith(consent: string): Promise<never> {
  const { email } = await requireStaff("supporters");
  const id = await createBroadcastDraft(email, { contact: consent.split(" ") });
  if (!id) throw new Error("New broadcast's Consent came as none answered yes");
  revalidatePath(LIST);
  redirect(pageOf(id));
}

/**
 * Changes the Consent draft `id` goes under, as its writer's lozenges are
 * pressed, and says the draft's version it made. Refused for one that's gone
 * or no longer a draft ("gone"), and for one that has words now, which
 * another channel's Consent would lose ("conflict"); either way its page is
 * shown afresh.
 */
export async function changeBroadcastConsentNow(
  id: number,
  consent: string,
): Promise<FormResult<"gone" | "conflict", { version: number }>> {
  const { email } = await requireStaff("supporters");
  ownNumber(id, "its ID");
  if (!choiceTerms(consent)) throw new Error("A broadcast's Consent came as none of its lists'");
  const changed = await changeBroadcastConsent(id, consent, email);
  revalidatePath(pageOf(id));
  if (changed !== false) return { ok: true, version: changed };
  return refused((await getWrittenBroadcast(id))?.state === "draft" ? "conflict" : "gone");
}

/** What a reply's buttons record it as. */
const DECISIONS: readonly ReplyDecision[] = ["topics", "bulk", "nothing"];

/**
 * A reply's buttons on its Thread: records it as an opt-out, of what its
 * email went under or of all bulk email, or as nothing to do, as the staff
 * member; then its page is shown afresh. Refused for one that isn't waiting
 * any more, as someone has recorded it since, or it's gone.
 */
export async function dealWithReplyNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff("supporters");
  const replyId = ownId(form, "replyId");
  const decision = DECISIONS.find((one) => one === form.get("decision"));
  if (!decision) throw new Error("A reply's form came without what to record it as");
  const dealt = await dealWithReply(replyId, decision, email);
  revalidatePath(LIST, "layout");
  return dealt ? { ok: true } : refused("gone");
}

/** A draft's own ID, as the page makes it: a UUID. */
const DRAFT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Send reply on a reply's Thread: sends the staff member's answer, once for
 * the page's `draftId`, and shows the page afresh once it's gone; or says
 * why it didn't go.
 */
export async function answerReplyNow(
  replyId: number,
  draftId: string,
  body: unknown,
): Promise<FormResult<Exclude<AnswerResult, { sent: true }>["reason"]>> {
  const { email } = await requireStaff("supporters");
  ownNumber(replyId, "a reply's ID");
  if (!DRAFT_ID.test(draftId)) throw new Error("An answer came without its draft's ID");
  const result = await answerReply(replyId, draftId, body, email);
  if (!result.sent) return refused(result.reason);
  revalidatePath(LIST, "layout");
  return { ok: true };
}

/**
 * An emoji under someone's message on its Thread: puts it on their message
 * on WhatsApp as the staff member, or takes ours away (an empty one), and
 * shows the page afresh once it's gone; or says why it didn't go.
 */
export async function reactToReplyNow(
  replyId: number,
  emoji: string,
): Promise<FormResult<Exclude<ReactionResult, { sent: true }>["reason"]>> {
  const { email } = await requireStaff("supporters");
  ownNumber(replyId, "a reply's ID");
  if (emoji !== "" && !(REACTIONS as readonly unknown[]).includes(emoji)) {
    throw new Error("A reaction came as an emoji that isn't one of ours");
  }
  const result = await reactToReply(replyId, emoji, email);
  if (!result.sent) return refused(result.reason);
  revalidatePath(LIST, "layout");
  return { ok: true };
}

/**
 * Keeps the form's filter for draft `id`, and goes back to it, which shows
 * how it stands if it's no longer a draft to keep one for.
 */
export async function keepFilterForBroadcast(id: number, form: FormData): Promise<never> {
  await requireStaff("supporters");
  await changeBroadcastFilter(ownNumber(id, "its ID"), whoFrom(form));
  revalidatePath(pageOf(id));
  redirect(pageOf(id));
}

/** Saves a draft's changes, if no one else has saved it since `version`. */
export async function saveBroadcast(
  id: number,
  version: number,
  changes: unknown,
): Promise<FormResult<SaveRefusal, { version: number }>> {
  await requireStaff("supporters");
  ownNumber(id, "its ID");
  ownNumber(version, "its version");
  const broadcast = await getWrittenBroadcast(id);
  if (!broadcast) return refused("gone");
  const parsed = broadcastChangesFrom(changes, broadcast.channel);
  if (!parsed) throw new Error("A broadcast's save came with changes its writer doesn't make");
  return saved(await saveBroadcastDraft(broadcast, version, parsed));
}

/** Attaches the form's file to a draft email at its version. */
export async function attachToBroadcast(form: FormData): Promise<FormResult<SaveRefusal | "too-big", Files>> {
  await requireStaff("supporters");
  const id = ownId(form);
  const version = ownId(form, "version");
  const file = form.get("file");
  if (!(file instanceof File) || !file.name) throw new Error("A broadcast's file came without the file");
  if (!(await getWrittenBroadcast(id))) return refused("gone");
  const added = await addAttachment(id, version, {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    content: Buffer.from(await file.arrayBuffer()),
  });
  if (!added.saved) return refused(added.reason);
  return { ok: true, version: added.version, attachments: (await getWrittenBroadcast(id))!.attachments };
}

/** Takes a file off a draft email at its version. */
export async function detachFromBroadcast(
  id: number,
  version: number,
  attachmentId: number,
): Promise<FormResult<SaveRefusal, Files>> {
  await requireStaff("supporters");
  ownNumber(version, "its version");
  ownNumber(attachmentId, "a file's ID");
  if (!(await getWrittenBroadcast(ownNumber(id, "its ID")))) return refused("gone");
  const removed = await removeAttachment(id, version, attachmentId);
  if (!removed.saved) return refused(removed.reason);
  return { ok: true, version: removed.version, attachments: (await getWrittenBroadcast(id))!.attachments };
}

/**
 * Sends one recipient's copy of a draft, as they'd get it, to `to`, or with
 * none the staff member's address, for an email, and says where it went.
 * The writer sends only an address a test can go to, so one that isn't is
 * thrown on. Refused for a draft that's gone, its page shown afresh, and
 * when the copy didn't go.
 */
export async function sendBroadcastTestNow(
  id: number,
  meets: unknown,
  to = "",
): Promise<FormResult<"gone" | "not-sent", { to: string }>> {
  const { email } = await requireStaff("supporters");
  if (!Array.isArray(meets) || !meets.every((one) => typeof one === "string")) {
    throw new Error("A test copy came without what its recipient meets");
  }
  const broadcast = await getWrittenBroadcast(ownNumber(id, "its ID"));
  if (!broadcast) {
    revalidatePath(pageOf(id));
    return refused("gone");
  }
  const address = to.trim() || (broadcast.channel === "email" ? email : "");
  if (broadcast.channel === "email" ? !looksLikeEmail(address) : !address) {
    throw new Error("A test copy came without an address it can go to");
  }
  // Filled in for someone made up, as the preview shows, never a real supporter.
  const result = await sendBroadcastTest(broadcast, fakeRecipient(meets, broadcast.channel), address);
  return result?.sent ? { ok: true, to: address } : refused("not-sent");
}

/**
 * Schedules a draft at its version, if nothing stops it. Refused for what
 * stops a save ("conflict", "not-draft", "gone"), for what's wrong with it
 * that its page hasn't caught up with ("not-ready"), and for why its new
 * words didn't go to WhatsApp for approval; not scheduled, its page is shown
 * afresh.
 */
export async function scheduleBroadcastNow(
  id: number,
  version: number,
): Promise<FormResult<SaveRefusal | TemplateRefusal, BroadcastScheduled>> {
  const { email } = await requireStaff("supporters");
  const result = await scheduleBroadcast(ownNumber(id, "its ID"), ownNumber(version, "its version"), email);
  revalidatePath(LIST);
  if (result.scheduled) return { ok: true, scheduled: true };
  revalidatePath(pageOf(id));
  if ("reason" in result) return refused(result.reason);
  if ("problems" in result) return refused("not-ready");
  return typeof result.submit === "object"
    ? { ok: true, scheduled: false, said: result.submit.failed }
    : refused(result.submit);
}

/** Sends draft text `id`'s new words to WhatsApp for approval, after what's typed is saved. */
export async function submitTemplateNow(id: number): Promise<FormResult<TemplateRefusal, TemplateTaken>> {
  const { email } = await requireStaff("supporters");
  const result = await submitTemplate(ownNumber(id, "its ID"), email);
  revalidatePath(LIST);
  revalidatePath(pageOf(id));
  if (result === "submitted") return { ok: true, taken: true };
  return typeof result === "object" ? { ok: true, taken: false, said: result.failed } : refused(result);
}

/**
 * Takes draft text `id`'s words back from WhatsApp's review, so they can be
 * changed. Refused when there are none waiting to take back, as WhatsApp has
 * decided, they're withdrawn already, or the draft's gone; its page is shown
 * afresh either way.
 */
export async function withdrawTemplateNow(id: number): Promise<FormResult<"gone">> {
  const { email } = await requireStaff("supporters");
  const withdrawn = await withdrawTemplate(ownNumber(id, "its ID"), email);
  revalidatePath(pageOf(id));
  return withdrawn ? { ok: true } : refused("gone");
}

/** Deletes approved template `templateId` from WhatsApp, if no broadcast ever had it; or says why not. */
export async function deleteTemplateNow(
  templateId: number,
): Promise<FormResult<Exclude<TemplateDeleteResult, "deleted">>> {
  const { email } = await requireStaff("supporters");
  const result = await deleteApprovedTemplate(ownNumber(templateId, "a template's ID"), email);
  revalidatePath(LIST, "layout");
  return result === "deleted" ? { ok: true } : refused(result);
}

/** The card WhatsApp would show at the top of a text for its link to `url`, for the writer's preview; null for none. */
export async function linkCardFor(url: string): Promise<FormResult<never, { card: LinkCard | null }>> {
  await requireStaff("supporters");
  if (typeof url !== "string") throw new Error("A link's card was asked for without its link");
  return { ok: true, card: await linkCard(url) };
}

/** The places a Google Maps link or words point at, for a text's map. */
export async function findPlacesFor(input: string): Promise<FormResult<never, { places: Place[] }>> {
  await requireStaff("supporters");
  if (typeof input !== "string") throw new Error("Places were asked for without words to find them by");
  return { ok: true, places: await findPlaces(input) };
}

/** Deletes the form's draft, then goes to the list of broadcasts. One that's gone already is as deleted as was asked. */
export async function deleteBroadcastDraft(form: FormData): Promise<never> {
  const { email } = await requireStaff("supporters");
  const id = ownId(form);
  if (await getWrittenBroadcast(id)) await deleteDraft(id, email);
  revalidatePath(LIST);
  redirect(LIST);
}

/**
 * Stops the form's broadcast: a scheduled one becomes a draft again; one
 * sending sends no more. Refused for one with nothing to stop, as it has all
 * gone, was stopped already, or is gone; its page is shown afresh either way.
 */
export async function stopBroadcastNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff("supporters");
  const id = ownId(form);
  const stopped = await stopBroadcast(id, email);
  revalidatePath(LIST);
  revalidatePath(pageOf(id));
  return stopped ? { ok: true } : refused("gone");
}

/**
 * Copy broadcast, on a broadcast's page: makes a draft that copies the
 * form's broadcast (copyBroadcast), and opens it. Refused for one that's
 * gone, the list shown afresh.
 */
export async function copyBroadcastNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff("supporters");
  const id = ownId(form);
  const copy = await copyBroadcast(id, email);
  revalidatePath(LIST);
  if (!copy) {
    revalidatePath(pageOf(id));
    return refused("gone");
  }
  redirect(pageOf(copy));
}

/**
 * Sets the form's broadcast going again, if it stopped as it hadn't all gone
 * in time. Refused for one that isn't stopped so any more, or is gone; its
 * page is shown afresh either way.
 */
export async function resumeBroadcastNow(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff("supporters");
  const id = ownId(form);
  const resumed = await resumeBroadcast(id, email);
  revalidatePath(LIST);
  revalidatePath(pageOf(id));
  return resumed ? { ok: true } : refused("gone");
}

/**
 * Change the times: when the form's broadcast goes, if it's scheduled, a day
 * and hour in London, and how long it keeps trying, in minutes
 * (retimeBroadcast), the most kept as none. How long is one of the form's
 * own choices, and a time it sends is one its fields make, so each is thrown
 * on when it isn't. Refused for times that have passed ("too-soon"), and for
 * a broadcast that's no longer scheduled or sending, or is gone ("gone");
 * its page is shown afresh either way.
 */
export async function rescheduleBroadcastNow(form: FormData): Promise<FormResult<"gone" | "too-soon">> {
  const { email } = await requireStaff("supporters");
  const id = ownId(form);
  const minutes = Number(form.get("finish-minutes"));
  if (!Number.isInteger(minutes) || !finishFits(finishKept(minutes))) {
    throw new Error("A broadcast's times came without how long it keeps trying");
  }
  const dueAt = dueAtFrom(form);
  if (form.has("day") && !dueAt) throw new Error("A broadcast's times came with a time that isn't one");
  const retimed = await retimeBroadcast(id, dueAt, finishKept(minutes), email);
  revalidatePath(LIST);
  revalidatePath(pageOf(id));
  if (retimed) return { ok: true };
  const state = (await getWrittenBroadcast(id))?.state;
  return refused(state === "scheduled" || state === "sending" ? "too-soon" : "gone");
}
