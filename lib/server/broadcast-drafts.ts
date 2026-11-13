import "server-only";
import { checkMailingDoc, letterFor, type MailingDoc } from "@/lib/mailing-doc";
import { toText } from "@/lib/letter-format";
import { storedFilter } from "@/lib/staff-search";
import { type Params } from "@/lib/list-params";
import { staffCopy } from "@/lib/content/staff-interface";
import {
  approvalProblems,
  BROADCAST_FIELDS,
  fakeRecipient,
  FIELDS_AS_WORDS,
  hasField,
  type FakeRecipient,
  hasWords,
  broadcastScheduleProblems,
  broadcastTerms,
  choiceTerms,
  isAvailableSendBy,
  rejectionWords,
  restsUntil,
  termsValues,
  BROADCAST_SENDER,
  TEXT_SENDER_NAME,
  type BroadcastChannel,
  type BroadcastScheduleProblem,
  type BroadcastSendBy,
  type BroadcastTerms,
} from "@/lib/broadcasts";
import { now } from "@/lib/now";
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
import { broadcastEmailChannel, channelSends, textBackend, textSenderNumber } from "./broadcast-channels";
import { createTemplate, deleteTemplate, sendTemplate } from "./outside-services/whatsapp";
import { problem } from "./problems";
import { metaName, templateParams, textResult } from "./whatsapp-texts";
import { templateFooter, templateText } from "@/lib/whatsapp-template";
import { supporterAudience } from "./broadcast-recipients";
import { notifyStaff, staffLink } from "./notifications";
import { filterProblems } from "./stored-filters";
import type { Topic } from "@/lib/contact-permissions";

// A broadcast to supporters written on the site: a mailing to the supporters
// list's filter, with one channel and its topics, fixed when it's made from
// the list's Consent filter. Saved as a mailing is (mailing-drafts.ts);
// sending finds who gets it, a message each. A text goes on a WhatsApp
// template: one approved, or new words, which staff send for approval and
// can schedule once WhatsApp has approved them.

/** A text's words, as WhatsApp approves them. */
export type WhatsAppTemplate = {
  id: number;
  name: string;
  body: MailingDoc;
  /** Waiting for WhatsApp, approved, rejected; or, once approved, paused or disabled by WhatsApp for its quality. */
  status: "pending" | "approved" | "rejected" | "paused" | "disabled";
  /** What WhatsApp approved it as, which may not be what it was sent as; null till it has. */
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION" | null;
  /** The name WhatsApp has it by, for one sent from here; one made in WhatsApp Manager has its own name there. */
  metaName: string | null;
  /** Who made it, or none for one made in WhatsApp Manager. */
  createdBy: string | null;
  approvedAt: Date | null;
  /** When it was sent to WhatsApp for approval, or made in WhatsApp Manager. */
  requestedAt: Date;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  /** Its footer as it went to WhatsApp, or none for one made in WhatsApp Manager. */
  footer: string | null;
  /** When it last went, and to how many; none if it never has. */
  lastUsedAt: Date | null;
  lastUsedTo: number;
};

export type WrittenBroadcast = WrittenMailing & {
  /** The subject, for an email; for a text, its template's name or its first words. */
  title: string;
  channel: BroadcastChannel;
  /** The topics whose yes it goes under, in TOPICS' order (BroadcastTerms). */
  topics: Topic[];
  template: WhatsAppTemplate | null;
  /** What sends it, for an email (lib/broadcasts.ts, BROADCAST_SEND_BY). */
  sendBy: BroadcastSendBy;
  /**
   * Since when it's waited for CiviCRM, and why; or that it stopped by
   * itself, and why (StopReason in broadcast-sending.ts).
   */
  waitingSince: Date | null;
  waitReason: "civicrm" | "pull" | "limit" | "template" | "late" | "failing" | null;
  gaveUp: boolean;
  /** Till when it rests, as its sends failed or what sends it couldn't for now (REST_MINUTES); null if it isn't. */
  restingUntil: Date | null;
};

const SELECT_TEMPLATES = `
  SELECT t.id::int AS id, t.name, t.body, t.status, t.category, t.meta_name AS "metaName", t.created_by AS "createdBy", t.approved_at AS "approvedAt", t.created_at AS "requestedAt",
    t.rejected_at AS "rejectedAt", t.rejected_reason AS "rejectedReason", t.footer, u.at AS "lastUsedAt", coalesce(u.n, 0)::int AS "lastUsedTo"
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

/** A broadcast's topics, in a query of `mailings`: its first (`topic`), then the others (`also_topics`). */
export const TOPICS_OF = "array_prepend(topic, also_topics)";

/** A broadcast's topics, as `mailings` keeps them: its first, and the others. */
const topicColumns = (terms: BroadcastTerms): [Topic, Topic[]] => [terms.topics[0], terms.topics.slice(1)];

/** A broadcast written here, as stored; undefined for none, or a mailing to politicians. */
export async function getWrittenBroadcast(id: number, opening = false): Promise<WrittenBroadcast | undefined> {
  const written = await (opening ? openWrittenMailing : getWrittenMailing)(id, "supporters");
  if (!written) return undefined;
  const [{ templateId, tryFailedAt, ...own }] = await query<
    Pick<WrittenBroadcast, "title" | "channel" | "topics" | "sendBy" | "waitingSince" | "waitReason" | "gaveUp"> & {
      templateId: number | null;
      tryFailedAt: Date | null;
    }
  >(
    `SELECT title, channel, ${TOPICS_OF} AS topics, template_id::int AS "templateId", send_by AS "sendBy",
       waiting_since AS "waitingSince",
       wait_reason AS "waitReason", gave_up AS "gaveUp", try_failed_at AS "tryFailedAt"
     FROM mailings WHERE id = $1`,
    [id],
  );
  const [template] = templateId
    ? await query<WhatsAppTemplate>(`${SELECT_TEMPLATES} WHERE t.id = $1`, [templateId])
    : [];
  const restsTill = tryFailedAt && restsUntil(tryFailedAt);
  const restingUntil = written.state === "sending" && restsTill && restsTill > now() ? restsTill : null;
  return { ...written, ...own, restingUntil, template: template ?? null };
}

/**
 * Who a new broadcast appears from: for an email the address we write
 * from; for a text our WhatsApp number, or none where WhatsApp doesn't send.
 */
const senderOf = async (channel: BroadcastChannel): Promise<{ sentFrom: string; fromName: string }> =>
  channel === "email"
    ? { sentFrom: BROADCAST_SENDER.email, fromName: BROADCAST_SENDER.name }
    : { sentFrom: (await textSenderNumber()) ?? "", fromName: TEXT_SENDER_NAME };

/**
 * Makes a draft to those the supporters list's `params` find, by `by`, its
 * channel and topics from their Consent filter. Returns its ID; undefined
 * with no Consent filter answered yes.
 */
export async function createBroadcastDraft(by: string, params: Params): Promise<number | undefined> {
  const filter = storedFilter("supporters", params);
  const terms = broadcastTerms(filter.params.contact);
  if (!terms) return undefined;
  const { sentFrom, fromName } = await senderOf(terms.channel);
  return transaction(async (db) => {
    const [{ id }] = await query<{ id: number }>(
      `INSERT INTO mailings (title, audience, channel, topic, also_topics, filter, body, created_by, sent_from, from_name, state)
       VALUES ('', 'supporters', $1, $2, $8, $3, $4, $5, $6, $7, 'draft') RETURNING id::int AS id`,
      [
        terms.channel,
        topicColumns(terms)[0],
        JSON.stringify(filter),
        JSON.stringify({ type: "doc", content: [] }),
        by,
        sentFrom,
        fromName,
        topicColumns(terms)[1],
      ],
      db,
    );
    await logChange(by, "create broadcast", { id, ...terms }, db);
    return id;
  });
}

/**
 * Keeps who a draft goes to: the list's `params`, while their Consent filter
 * still says its channel and topics, as they're fixed. Says whether it did.
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
 * Changes the Consent a draft goes under to `value`, topics answered yes,
 * keeping its other filters. To the other channel only while it has no words
 * of its own (hasWords), starting it afresh as one new on that channel is.
 * Says whether it did.
 */
export async function changeBroadcastConsent(id: number, value: string, by: string): Promise<boolean> {
  const broadcast = await getWrittenBroadcast(id);
  const terms = choiceTerms(value);
  if (broadcast?.state !== "draft" || !terms) return false;
  const moving = terms.channel !== broadcast.channel;
  if (moving && hasWords({ ...broadcast, templateId: broadcast.template?.id ?? null })) return false;
  const filter = storedFilter("supporters", { ...broadcast.filter.params, contact: termsValues(terms) });
  const sender = await senderOf(terms.channel);
  await query(
    `UPDATE mailings SET channel = $2, topic = $3, filter = $4, also_topics = $8,
       subject = CASE WHEN $5 THEN '' ELSE subject END,
       body = CASE WHEN $5 THEN '{"type": "doc", "content": []}'::jsonb ELSE body END,
       title = CASE WHEN $5 THEN '' ELSE title END,
       template_id = CASE WHEN $5 THEN NULL ELSE template_id END,
       sent_from = CASE WHEN $5 THEN $6 ELSE sent_from END,
       from_name = CASE WHEN $5 THEN $7 ELSE from_name END,
       version = version + 1, updated_at = now()
     WHERE id = $1`,
    [
      id,
      terms.channel,
      topicColumns(terms)[0],
      JSON.stringify(filter),
      moving,
      sender.sentFrom,
      sender.fromName,
      topicColumns(terms)[1],
    ],
  );
  await logChange(by, "change broadcast consent", { id, ...terms });
  return true;
}

/** Whether a filter's terms are the broadcast's own. */
export function sameTerms(terms: BroadcastTerms | undefined, broadcast: BroadcastTerms): boolean {
  return terms?.channel === broadcast.channel && terms.topics.join() === broadcast.topics.join();
}

/**
 * A save's changes as the writer sends them, if each is what it should be
 * for the channel. Neither says the address or the name it's from, which
 * are fixed (senderOf). An email may say what sends it, of what can now
 * (isAvailableSendBy). A text has no subject, may name a
 * template, or null for none, and may have a title of its own, as it has no
 * subject to be one.
 */
export function broadcastChangesFrom(value: unknown, channel: BroadcastChannel): MailingChanges | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { templateId, title, sendBy, ...rest } = value as Record<string, unknown>;
  const changes = mailingChangesFrom(rest);
  if (!changes || "ask" in changes || "sentFrom" in changes || "fromName" in changes) return undefined;
  if (channel === "email") {
    if (templateId !== undefined || title !== undefined) return undefined;
    if (sendBy === undefined) return changes;
    return isAvailableSendBy(sendBy) ? { ...changes, sendBy } : undefined;
  }
  if (sendBy !== undefined || "subject" in changes) return undefined;
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

/**
 * How what sends a broadcast stands, for the page to say and for scheduling
 * to check: whether it goes by Gmail, and then whether the Gmail it's from
 * is connected; and how many more emails it can send today, null for no
 * limit, or a text.
 */
export async function broadcastSender(
  broadcast: Pick<WrittenBroadcast, "channel" | "sendBy" | "sentFrom">,
): Promise<{ byGmail: boolean; connected: boolean; remaining: number | null }> {
  if (broadcast.channel !== "email") return { byGmail: false, connected: false, remaining: null };
  const byGmail = broadcast.sendBy === "gmail";
  const { channel } = broadcastEmailChannel(broadcast.sendBy);
  const [connected, remaining] = await Promise.all([
    byGmail ? gmailAccount(broadcast.sentFrom!) : undefined,
    channel.remainingToday(broadcast.sentFrom!),
  ]);
  return { byGmail, connected: Boolean(connected), remaining };
}

/** What stops a broadcast being scheduled, as it's stored, and how many it would go to now. */
async function scheduleProblems(
  broadcast: WrittenBroadcast,
): Promise<{ problems: BroadcastScheduleProblem[]; recipients: number }> {
  const [audience, unknown, sender] = await Promise.all([
    supporterAudience(broadcast.filter, broadcast),
    filterProblems(broadcast.filter),
    broadcastSender(broadcast),
  ]);
  const problems = broadcastScheduleProblems({
    ...broadcast,
    recipients: audience.recipients.length,
    unknown,
    ...sender,
    approved: broadcast.template?.status === "approved",
    numbered: Boolean(await textSenderNumber()),
    sends: channelSends(broadcast.channel, broadcast.sendBy),
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

/**
 * Stops a broadcast: a scheduled one becomes a draft again; one sending
 * sends no more. Either waits for CiviCRM no longer, so scheduled again it
 * has its days to wait afresh (waitStopsAt). Says whether it stopped.
 */
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
    await query("UPDATE mailings SET waiting_since = NULL, wait_reason = NULL WHERE id = $1", [id], db);
    await logChange(by, "stop broadcast", { id, was: broadcast.state }, db);
    return true;
  });
}

/**
 * A copy `c` that failed in a way it can be sent again: its channel refused
 * it, rather than its send breaking off, when it may have gone, and it
 * didn't bounce, which blocks the address.
 */
export const SEND_AGAIN = `c.status = 'failed'
  AND NOT EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id
                  AND (e.kind = 'bounced' OR (e.kind = 'failed' AND e.details ? 'unfinished')))`;

/**
 * Sets going again a broadcast that stopped as it hadn't all gone in time
 * (gave_up): its copies that never went are to go again, or, for one that
 * never started, it's scheduled again. From now, so it has its days to go
 * in again (sendingStopsAt), and waiting for nothing, so its days to wait
 * too (waitStopsAt); nor resting after tries that failed before it stopped,
 * so it goes at the next run. One that stopped as its copies kept failing
 * sends again those its channel refused too (SEND_AGAIN), as whatever
 * failed them should be fixed by now. Says whether it did.
 */
export async function resumeBroadcast(id: number, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const [stopped] = await query<{ started: boolean; failing: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM broadcast_messages c WHERE c.mailing_id = m.id) AS started,
         m.wait_reason = 'failing' AS failing
       FROM mailings m WHERE m.id = $1 AND m.audience = 'supporters' AND m.state = 'cancelled' AND m.gave_up
       FOR UPDATE`,
      [id],
      db,
    );
    if (!stopped) return false;
    const copies = await query(
      `UPDATE broadcast_messages c SET status = 'scheduled', handed_at = NULL
       WHERE c.mailing_id = $1 AND (c.status = 'cancelled' OR ($2 AND ${SEND_AGAIN})) RETURNING id`,
      [id, stopped.failing],
      db,
    );
    await query(
      `UPDATE mailings SET state = $2, gave_up = false, waiting_since = NULL, wait_reason = NULL, due_at = $3,
         try_failed_at = NULL, failed_in_a_row = 0, updated_at = now()
       WHERE id = $1`,
      [id, stopped.started ? "sending" : "scheduled", now()],
      db,
    );
    await logChange(by, "resume broadcast", { id, copies: copies.length }, db);
    return true;
  });
}

/** A template's words for an email: its fields as words, such as {First name}. */
const templateWords = (body: MailingDoc): string => toText(letterFor(body, FIELDS_AS_WORDS));

/** Where a draft text is, for a link in an email. */
const draftLink = (id: number): string => staffLink(`/staff/broadcasts/${id}`, undefined);

export type TemplateSubmitResult =
  "submitted" | "no-words" | "not-ready" | "already" | "not-text" | "not-draft" | "gone" | "failed";

/**
 * Sends a template's words to WhatsApp for approval, as a marketing
 * template in British English, each field a named parameter with an
 * example, and a footer saying a reply of stop stops its topics; keeps WhatsApp's
 * ID for it. Says whether WhatsApp took them, reporting it if not.
 */
async function sendForApproval(template: {
  id: number;
  metaName: string;
  body: MailingDoc;
  topics: Topic[];
}): Promise<boolean> {
  const backend = await textBackend();
  if (!backend) return false;
  const footer = templateFooter(template.topics);
  try {
    const made = await createTemplate(backend.keys, {
      name: template.metaName,
      body: templateText(template.body),
      examples: templateParams(template.body, fakeRecipient(BROADCAST_FIELDS.map(hasField), "text")),
      footer,
    });
    // Its footer kept as it went, so every page shows what people got.
    await query("UPDATE whatsapp_templates SET meta_id = $2, footer = $3 WHERE id = $1", [
      template.id,
      made.id,
      footer,
    ]);
    return true;
  } catch (error) {
    problem(staffCopy.problems.anywhere.templateNotSent(template.metaName), error);
    return false;
  }
}

/**
 * Sends a draft text's new words to WhatsApp for approval, as a new
 * template it then waits on: they can't be changed till WhatsApp decides,
 * or they're withdrawn. It's called what the text is called. Emails who sent
 * them and the notification inbox the
 * words. Not for words that are an approved template, or waiting already, nor
 * a text that anything but its time would stop being scheduled. If WhatsApp
 * doesn't take them, they're as they were, to send again (`failed`).
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
    const [{ templateId }] = await query<{ templateId: number }>(
      `WITH t AS (INSERT INTO whatsapp_templates (name, body, status, created_by)
         VALUES ($2, $3, 'pending', $4) RETURNING id)
       UPDATE mailings SET template_id = t.id, title = $2, updated_at = now() FROM t WHERE mailings.id = $1
       RETURNING t.id::int AS "templateId"`,
      [id, name, JSON.stringify(broadcast.body), by],
      db,
    );
    const meta = metaName(name, templateId);
    await query("UPDATE whatsapp_templates SET meta_name = $2 WHERE id = $1", [templateId, meta], db);
    return {
      name,
      body: broadcast.body,
      topics: broadcast.topics,
      templateId,
      metaName: meta,
      before: broadcast.template?.id ?? null,
    };
  });
  if (typeof result === "string") return result;
  if (
    !(await sendForApproval({
      id: result.templateId,
      metaName: result.metaName,
      body: result.body,
      topics: result.topics,
    }))
  ) {
    // As it was before: the words back to change or send again, and the rejected template they were on, if any.
    await query("UPDATE mailings SET template_id = $2, updated_at = now() WHERE id = $1", [id, result.before]);
    await query("DELETE FROM whatsapp_templates WHERE id = $1", [result.templateId]);
    return "failed";
  }
  await logChange(by, "submit broadcast template", { id, name: result.name });
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

/**
 * Takes back a draft text's words from WhatsApp's review, so they can be
 * changed, deleting them at WhatsApp too: if that fails, it's reported,
 * and whatever WhatsApp decides of them is ignored. Says whether it did.
 */
export async function withdrawTemplate(id: number, by: string): Promise<boolean> {
  const withdrawn = await transaction(async (db) => {
    const [broadcast] = await query<{ templateId: number; metaName: string | null }>(
      `SELECT m.template_id::int AS "templateId", t.meta_name AS "metaName"
       FROM mailings m JOIN whatsapp_templates t ON t.id = m.template_id
       WHERE m.id = $1 AND m.audience = 'supporters' AND m.state = 'draft' AND t.status = 'pending' FOR UPDATE OF m`,
      [id],
      db,
    );
    if (!broadcast) return undefined;
    await query("UPDATE mailings SET template_id = NULL, updated_at = now() WHERE id = $1", [id], db);
    await query("DELETE FROM whatsapp_templates WHERE id = $1", [broadcast.templateId], db);
    await logChange(by, "withdraw broadcast template", { id }, db);
    return broadcast;
  });
  if (!withdrawn) return false;
  const backend = withdrawn.metaName ? await textBackend() : undefined;
  if (backend) {
    try {
      await deleteTemplate(backend.keys, withdrawn.metaName!);
    } catch (error) {
      problem(staffCopy.problems.anywhere.templateNotDeleted(withdrawn.metaName!), error);
    }
  }
  return true;
}

/** What WhatsApp decided about a template: approved, or rejected and why, by its code (INVALID_FORMAT), which is kept. */
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
    : [
        copy.templateRejected.subject(template.name),
        copy.templateRejected.body(rejectionWords(review.reason), words, links),
      ];
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
  if (broadcast.template?.status !== "approved") return undefined;
  const backend = await textBackend();
  if (!backend) return undefined;
  const template = broadcast.template;
  return textResult(
    await sendTemplate(backend.keys, backend.number.id, to, {
      name: template.metaName ?? template.name,
      params: templateParams(template.body, recipient),
    }),
  );
}
