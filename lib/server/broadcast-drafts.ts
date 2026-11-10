import "server-only";
import { checkMailingDoc, letterFor, type MailingDoc } from "@/lib/mailing-doc";
import { toText } from "@/lib/letter-format";
import { storedFilter } from "@/lib/staff-search";
import { type Params } from "@/lib/list-params";
import { staffCopy } from "@/lib/content/staff-interface";
import {
  approvalProblems,
  FIELDS_AS_WORDS,
  type FakeRecipient,
  hasWords,
  broadcastScheduleProblems,
  broadcastTerms,
  BROADCAST_SENDER,
  TEXT_SENDER_NAME,
  type BroadcastChannel,
  type BroadcastScheduleProblem,
  type BroadcastTerms,
} from "@/lib/broadcasts";
import { logChange } from "./audit";
import { query, transaction } from "./db";
import { gmailAccount } from "./gmail-accounts";
import type { ChannelResult } from "./mailing-channels";
import {
  getWrittenMailing,
  lockDraft,
  mailingChangesFrom,
  markCancelled,
  markScheduled,
  markUnscheduled,
  openWrittenMailing,
  saveDraft,
  sendTestCopy,
  type MailingChanges,
  type SaveResult,
  type WrittenMailing,
} from "./mailing-drafts";
import { broadcastBackend, textSenderNumber } from "./broadcast-channels";
import { supporterAudience } from "./broadcast-recipients";
import { notifyStaff, staffLink } from "./notifications";
import { filterProblems } from "./stored-filters";
import type { Topic } from "@/lib/contact-permissions";

// A broadcast to supporters written on the site: a mailing to the supporters
// list's filter, with one channel and one topic, fixed when it's made from
// the list's Consent filter. Saved as a mailing is (mailing-drafts.ts);
// sending finds who gets it, a message each. A text goes on a WhatsApp
// template: one approved, or new words, which staff send for approval and
// can schedule once WhatsApp has approved them.

/** A text's words, as WhatsApp approves them. */
export type WhatsAppTemplate = {
  id: number;
  name: string;
  body: MailingDoc;
  status: "pending" | "approved" | "rejected";
  /** Who made it, or none for one made in WhatsApp Manager. */
  createdBy: string | null;
  approvedAt: Date | null;
  /** When it was sent to WhatsApp for approval, or made in WhatsApp Manager. */
  requestedAt: Date;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  /** When it last went, and to how many; none if it never has. */
  lastUsedAt: Date | null;
  lastUsedTo: number;
};

export type WrittenBroadcast = WrittenMailing & {
  /** The subject, for an email; for a text, its template's name or its first words. */
  title: string;
  channel: BroadcastChannel;
  topic: Topic;
  template: WhatsAppTemplate | null;
};

const SELECT_TEMPLATES = `
  SELECT t.id::int AS id, t.name, t.body, t.status, t.created_by AS "createdBy", t.approved_at AS "approvedAt", t.created_at AS "requestedAt",
    t.rejected_at AS "rejectedAt", t.rejected_reason AS "rejectedReason", u.at AS "lastUsedAt", coalesce(u.n, 0)::int AS "lastUsedTo"
  FROM whatsapp_templates t LEFT JOIN LATERAL (
    SELECT m.due_at AS at, (SELECT count(*) FROM broadcast_messages c WHERE c.mailing_id = m.id) AS n
    FROM mailings m WHERE m.template_id = t.id AND m.state IN ('sending', 'sent', 'cancelled')
    ORDER BY m.due_at DESC LIMIT 1) u ON true`;

/** The templates WhatsApp has approved, most recently used first, then newest approved. */
export async function approvedTemplates(): Promise<WhatsAppTemplate[]> {
  return query<WhatsAppTemplate>(
    `${SELECT_TEMPLATES} WHERE t.status = 'approved' ORDER BY u.at DESC NULLS LAST, t.approved_at DESC, t.id DESC`,
  );
}

/** A broadcast written here, as stored; undefined for none, or a mailing to politicians. */
export async function getWrittenBroadcast(id: number, opening = false): Promise<WrittenBroadcast | undefined> {
  const written = await (opening ? openWrittenMailing : getWrittenMailing)(id, "supporters");
  if (!written) return undefined;
  const [{ title, channel, topic, templateId }] = await query<{
    title: string;
    channel: BroadcastChannel;
    topic: Topic;
    templateId: number | null;
  }>(`SELECT title, channel, topic, template_id::int AS "templateId" FROM mailings WHERE id = $1`, [id]);
  const [template] = templateId
    ? await query<WhatsAppTemplate>(`${SELECT_TEMPLATES} WHERE t.id = $1`, [templateId])
    : [];
  return { ...written, title, channel, topic, template: template ?? null };
}

/** Who a new broadcast appears from: for an email the address we write from; for a text the business account. */
const senderOf = (channel: BroadcastChannel): { sentFrom: string; fromName: string } =>
  channel === "email"
    ? { sentFrom: BROADCAST_SENDER.email, fromName: BROADCAST_SENDER.name }
    : { sentFrom: textSenderNumber() ?? "", fromName: TEXT_SENDER_NAME };

/**
 * Makes a draft to those the supporters list's `params` find, by `by`, its
 * channel and topic from their Consent filter. Returns its ID; undefined
 * with no Consent filter answered yes.
 */
export async function createBroadcastDraft(by: string, params: Params): Promise<number | undefined> {
  const filter = storedFilter("supporters", params);
  const terms = broadcastTerms(filter.params.contact);
  if (!terms) return undefined;
  const { sentFrom, fromName } = senderOf(terms.channel);
  return transaction(async (db) => {
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO mailings (title, audience, channel, topic, filter, body, created_by, sent_from, from_name, state)
       VALUES ('', 'supporters', $1, $2, $3, $4, $5, $6, $7, 'draft') RETURNING id::int AS id`,
      [
        terms.channel,
        terms.topic,
        JSON.stringify(filter),
        JSON.stringify({ type: "doc", content: [] }),
        by,
        sentFrom,
        fromName,
      ],
      db,
    );
    await logChange(by, "create broadcast", { id, channel: terms.channel, topic: terms.topic }, db);
    return id;
  });
}

/**
 * Keeps who a draft goes to: the list's `params`, while their Consent filter
 * still says its channel and topic, as they're fixed. Says whether it did.
 */
export async function changeBroadcastFilter(id: number, params: Params): Promise<boolean> {
  const broadcast = await getWrittenBroadcast(id);
  if (broadcast?.state !== "draft") return false;
  const filter = storedFilter("supporters", params);
  if (!sameTerms(broadcastTerms(filter.params.contact), broadcast)) return false;
  await query("UPDATE mailings SET filter = $2, version = version + 1, updated_at = now() WHERE id = $1", [
    id,
    JSON.stringify(filter),
  ]);
  return true;
}

/**
 * Changes the Consent a draft goes under to `value`, one topic answered yes,
 * keeping its other filters. To the other channel only while it has no words
 * of its own (hasWords), starting it afresh as one new on that channel is.
 * Says whether it did.
 */
export async function changeBroadcastConsent(id: number, value: string, by: string): Promise<boolean> {
  const broadcast = await getWrittenBroadcast(id);
  const terms = broadcastTerms(value);
  if (broadcast?.state !== "draft" || !terms) return false;
  const moving = terms.channel !== broadcast.channel;
  if (moving && hasWords({ ...broadcast, templateId: broadcast.template?.id ?? null })) return false;
  const filter = storedFilter("supporters", { ...broadcast.filter.params, contact: value });
  const sender = senderOf(terms.channel);
  await query(
    `UPDATE mailings SET channel = $2, topic = $3, filter = $4,
       subject = CASE WHEN $5 THEN '' ELSE subject END,
       body = CASE WHEN $5 THEN '{"type": "doc", "content": []}'::jsonb ELSE body END,
       title = CASE WHEN $5 THEN '' ELSE title END,
       template_id = CASE WHEN $5 THEN NULL ELSE template_id END,
       sent_from = CASE WHEN $5 THEN $6 ELSE sent_from END,
       from_name = CASE WHEN $5 THEN $7 ELSE from_name END,
       version = version + 1, updated_at = now()
     WHERE id = $1`,
    [id, terms.channel, terms.topic, JSON.stringify(filter), moving, sender.sentFrom, sender.fromName],
  );
  await logChange(by, "change broadcast consent", { id, channel: terms.channel, topic: terms.topic });
  return true;
}

/** Whether a filter's terms are the broadcast's own. */
export function sameTerms(terms: BroadcastTerms | undefined, broadcast: BroadcastTerms): boolean {
  return terms?.channel === broadcast.channel && terms.topic === broadcast.topic;
}

/**
 * A save's changes as the writer sends them, if each is what it should be
 * for the channel: a text has no subject, says who it's from by its account,
 * may name a template, or null for none, and may have a title of its own, as
 * it has no subject to be one.
 */
export function broadcastChangesFrom(value: unknown, channel: BroadcastChannel): MailingChanges | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { templateId, title, ...rest } = value as Record<string, unknown>;
  const changes = mailingChangesFrom(rest);
  if (!changes || "ask" in changes) return undefined;
  if (channel === "email") return templateId === undefined && title === undefined ? changes : undefined;
  if ("subject" in changes || "sentFrom" in changes || "fromName" in changes) return undefined;
  if (title !== undefined && typeof title !== "string") return undefined;
  const titled = title === undefined ? changes : { ...changes, title };
  if (templateId === undefined) return titled;
  return typeof templateId === "number" || templateId === null ? { ...titled, templateId } : undefined;
}

/**
 * Saves changes to a draft broadcast at `version`. Choosing a template takes
 * its words and name, unless a title is given too; a text's new words are
 * named as staff name them.
 */
export async function saveBroadcastDraft(
  broadcast: WrittenBroadcast,
  version: number,
  changes: MailingChanges,
): Promise<SaveResult> {
  if (broadcast.channel === "email") return saveDraft(broadcast.id, version, changes);
  // Words WhatsApp is reviewing stay as they were sent.
  if (broadcast.template?.status === "pending" && ("body" in changes || "templateId" in changes)) {
    return { saved: false, reason: "conflict" };
  }
  const template = changes.templateId
    ? (await approvedTemplates()).find((one) => one.id === changes.templateId)
    : undefined;
  if (changes.templateId && !template) return { saved: false, reason: "conflict" };
  if (template) {
    return saveDraft(broadcast.id, version, {
      ...changes,
      body: checkMailingDoc(template.body)!,
      title: changes.title ?? template.name,
    });
  }
  return saveDraft(broadcast.id, version, changes);
}

export type BroadcastScheduleResult =
  | { scheduled: true }
  | { scheduled: false; problems: BroadcastScheduleProblem[] }
  | { scheduled: false; reason: "conflict" | "not-draft" | "gone" };

/** What stops a broadcast being scheduled, as it's stored, and how many it would go to now. */
async function scheduleProblems(
  broadcast: WrittenBroadcast,
): Promise<{ problems: BroadcastScheduleProblem[]; recipients: number }> {
  // From a staff member's Gmail, rather than by Postmark, it needs that Gmail connected.
  const byGmail = broadcast.channel === "email" && broadcast.sentFrom !== BROADCAST_SENDER.email;
  const [audience, unknown, connected] = await Promise.all([
    supporterAudience(broadcast.filter, broadcast),
    filterProblems(broadcast.filter),
    byGmail ? gmailAccount(broadcast.sentFrom!) : undefined,
  ]);
  const problems = broadcastScheduleProblems({
    ...broadcast,
    recipients: audience.recipients.length,
    unknown,
    byGmail,
    connected: Boolean(connected),
    approved: broadcast.template?.status === "approved",
    numbered: Boolean(textSenderNumber()),
    sends: Boolean(broadcastBackend()),
  });
  return { problems, recipients: audience.recipients.length };
}

/**
 * Schedules a draft broadcast at `version`, if nothing stops it. Who it goes to
 * isn't fixed: sending finds them, a message each, keeping their name, place
 * and merge values, which erasing them deletes. A text goes only on a
 * template WhatsApp has approved.
 */
export async function scheduleBroadcast(id: number, version: number, by: string): Promise<BroadcastScheduleResult> {
  return transaction(async (db) => {
    const refused = await lockDraft(id, version, db, "supporters");
    if (refused) return { scheduled: false, reason: refused };
    const broadcast = (await getWrittenBroadcast(id))!;
    const { problems, recipients } = await scheduleProblems(broadcast);
    if (problems.length) return { scheduled: false, problems };
    await markScheduled(id, db);
    // Who it goes to isn't kept: sending finds them, so it reaches whoever the filters find then.
    await logChange(by, "schedule broadcast", { id, recipients }, db);
    return { scheduled: true };
  });
}

/** Stops a broadcast: a scheduled one becomes a draft again; one sending sends no more. Says whether it stopped. */
export async function stopBroadcast(id: number, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const [broadcast] = await query<{ state: string }>(
      "SELECT state FROM mailings WHERE id = $1 AND audience = 'supporters' FOR UPDATE",
      [id],
      db,
    );
    if (broadcast?.state === "scheduled") {
      await markUnscheduled(id, db);
    } else if (broadcast?.state === "sending") {
      await query(
        "UPDATE broadcast_messages SET status = 'cancelled' WHERE status = 'scheduled' AND mailing_id = $1",
        [id],
        db,
      );
      await markCancelled(id, db);
    } else {
      return false;
    }
    await logChange(by, "stop broadcast", { id, was: broadcast.state }, db);
    return true;
  });
}

/** A template's words for an email: its fields as words, such as {First name}. */
const templateWords = (body: MailingDoc): string => toText(letterFor(body, FIELDS_AS_WORDS));

/** Where a draft text is, for a link in an email. */
const draftLink = (id: number): string => staffLink(`/staff/broadcasts/${id}`, undefined);

export type TemplateSubmitResult =
  "submitted" | "no-words" | "not-ready" | "already" | "not-text" | "not-draft" | "gone";

/**
 * Sends a draft text's new words to WhatsApp for approval, as a new
 * template it then waits on: they can't be changed till WhatsApp decides,
 * or they're withdrawn. It's called what the text is called. Emails who sent
 * them and the notification inbox the
 * words. Not for words that are an approved template, or waiting already, nor
 * a text that anything but its time would stop being scheduled.
 */
export async function submitTemplate(id: number, by: string): Promise<TemplateSubmitResult> {
  const result = await transaction(async (db) => {
    const [locked] = await query<{ state: string }>(
      "SELECT state FROM mailings WHERE id = $1 AND audience = 'supporters' FOR UPDATE",
      [id],
      db,
    );
    if (!locked) return "gone" as const;
    if (locked.state !== "draft") return "not-draft" as const;
    const broadcast = (await getWrittenBroadcast(id))!;
    if (broadcast.channel !== "text") return "not-text" as const;
    if (broadcast.template && broadcast.template.status !== "rejected") return "already" as const;
    if (!hasWords({ subject: "", body: broadcast.body, templateId: null })) return "no-words" as const;
    // Only a text otherwise ready to schedule, so what WhatsApp approves is what goes.
    if (approvalProblems((await scheduleProblems(broadcast)).problems).length) return "not-ready" as const;
    // As staff named it: a text with no name isn't ready (approvalProblems).
    const name = broadcast.title.trim();
    await query(
      `WITH t AS (INSERT INTO whatsapp_templates (name, body, status, created_by)
         VALUES ($2, $3, 'pending', $4) RETURNING id)
       UPDATE mailings SET template_id = t.id, title = $2, updated_at = now() FROM t WHERE mailings.id = $1`,
      [id, name, JSON.stringify(broadcast.body), by],
      db,
    );
    await logChange(by, "submit broadcast template", { id, name }, db);
    return { name, body: broadcast.body };
  });
  if (typeof result === "string") return result;
  const email = staffCopy.notifications.templateSubmitted;
  await notifyStaff(
    email.subject(result.name),
    email.body(by, templateWords(result.body), draftLink(id)),
    null,
    "staff-alert",
    by,
  );
  return "submitted";
}

/** Takes back a draft text's words from WhatsApp's review, so they can be changed. Says whether it did. */
export async function withdrawTemplate(id: number, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const [broadcast] = await query<{ templateId: number }>(
      `SELECT m.template_id::int AS "templateId" FROM mailings m JOIN whatsapp_templates t ON t.id = m.template_id
       WHERE m.id = $1 AND m.audience = 'supporters' AND m.state = 'draft' AND t.status = 'pending' FOR UPDATE OF m`,
      [id],
      db,
    );
    if (!broadcast) return false;
    await query("UPDATE mailings SET template_id = NULL, updated_at = now() WHERE id = $1", [id], db);
    await query("DELETE FROM whatsapp_templates WHERE id = $1", [broadcast.templateId], db);
    await logChange(by, "withdraw broadcast template", { id }, db);
    return true;
  });
}

/** What WhatsApp decided about a template: approved, or rejected and why. */
export type TemplateReview = { approved: true } | { approved: false; reason: string };

/**
 * Records WhatsApp's decision on a template waiting for it, as its webhook
 * or a check of its templates tells it, and emails whoever sent it and the
 * notification inbox, with the words and the texts on them. An approved
 * template can be scheduled; a rejected one's words can be changed and sent
 * again. Says whether there was one waiting.
 */
export async function reviewTemplate(templateId: number, review: TemplateReview): Promise<boolean> {
  const [template] = await query<{ name: string; body: MailingDoc; createdBy: string | null }>(
    `UPDATE whatsapp_templates SET status = $2,
       approved_at = CASE WHEN $2 = 'approved' THEN now() END,
       rejected_at = CASE WHEN $2 = 'rejected' THEN now() END, rejected_reason = $3
     WHERE id = $1 AND status = 'pending' RETURNING name, body, created_by AS "createdBy"`,
    [templateId, review.approved ? "approved" : "rejected", review.approved ? null : review.reason],
  );
  if (!template) return false;
  const texts = await query<{ id: number }>("SELECT id::int AS id FROM mailings WHERE template_id = $1 ORDER BY id", [
    templateId,
  ]);
  const words = templateWords(template.body);
  const links = texts.map((text) => draftLink(text.id));
  const copy = staffCopy.notifications;
  const [subject, body] = review.approved
    ? [copy.templateApproved.subject(template.name), copy.templateApproved.body(words, links)]
    : [copy.templateRejected.subject(template.name), copy.templateRejected.body(review.reason, words, links)];
  await notifyStaff(subject, body, null, "staff-alert", template.createdBy ?? undefined);
  return true;
}

/**
 * Sends `to` one recipient's copy of a draft, as they'd get it: an email by
 * Postmark or the Gmail it's from, whatever the recipient's permissions; a
 * text by the backend, only on an approved template, as WhatsApp sends no
 * other. Undefined when it can't go.
 */
export async function sendBroadcastTest(
  broadcast: WrittenBroadcast,
  recipient: FakeRecipient,
  to: string,
): Promise<ChannelResult | undefined> {
  if (broadcast.channel === "email") return sendTestCopy(broadcast, recipient, to);
  const backend = broadcastBackend();
  if (!backend || broadcast.template?.status !== "approved") return undefined;
  return backend.send({
    channel: "text",
    to,
    subject: broadcast.template.name,
    text: toText(letterFor(broadcast.body, recipient)),
  });
}
