import "server-only";
import { checkMailingDoc, letterFor, type MailingDoc } from "@/lib/mailings/doc";
import { toText } from "@/lib/letters/format";
import { storedFilter } from "@/lib/staff-search";
import { type Params } from "@/lib/list-params";
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
  finishFits,
  sendingStopsAt,
  isAvailableSendBy,
  rejectionWords,
  sameTemplate,
  sameWords,
  termsValues,
  BROADCAST_SENDER,
  DEFAULT_SEND_BY,
  TEXT_SENDER_NAME,
  type BroadcastChannel,
  type BroadcastScheduleProblem,
  type BroadcastSendBy,
  type BroadcastTerms,
} from "./broadcasts";
import { now } from "@/lib/now";
import { sendsAt } from "@/lib/staff-time";
import { logChange } from "@/lib/server/audit.server";
import { query, transaction } from "@/lib/server/db.server";
import { gmailAccount, GMAIL_DAILY_LIMIT } from "@/lib/email/gmail-accounts.server";
import type { ChannelResult } from "@/lib/letters/channels.server";
import {
  attachmentsOf,
  getWrittenMailing,
  lockDraft,
  mailingChangesFrom,
  markCancelled,
  markScheduled,
  markUnscheduled,
  openWrittenMailing,
  saveDraft,
  type MailingChanges,
  type SaveResult,
  type WrittenMailing,
} from "@/lib/mailings/drafts.server";
import { broadcastEmailChannel, channelSends, textBackend, textSenderNumber } from "./channels.server";
import { broadcastEmail, testLinks } from "./email-message.server";
import { orFallback } from "@/lib/server/outside-services/fallback.server";
import {
  createTemplate,
  uploadExample,
  deleteTemplate,
  sendTemplate,
  WhatsAppRequestError,
} from "@/lib/server/outside-services/whatsapp.server";
import { problem } from "@/lib/server/problems.server";
import { metaName, templateParams, textResult, textsLeftToday } from "./whatsapp-texts.server";
import {
  buttonsFrom,
  headerFrom,
  inOrder,
  pictureFrom,
  placeFrom,
  versionFrom,
  type TextButton,
  type TextHeader,
  type TextPlace,
  type TextTemplateParts,
  type TextVersion,
} from "./text-parts";
import { TEMPLATE_FOOTER, templateText } from "./whatsapp-template";
import { broadcastParts, supporterAudience } from "./recipients.server";
import { pictureAddress, pictureOf } from "./text-pictures.server";
import { config } from "@/lib/server/config.server";
import { notifyStaff, staffLink } from "@/lib/email/notifications.server";
import { filterProblems } from "@/lib/server/stored-filters.server";
import { consentLeftOut, type Topic } from "@/lib/supporters/contact-permissions";
import { broadcastProblems, broadcastsCopy } from "./copy";
import { DELAYED } from "./delayed";
import { publicText } from "@/lib/problems";

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
  /**
   * Waiting for WhatsApp, approved, rejected; or, once approved, paused or
   * disabled by WhatsApp for its quality, or deleted by staff.
   */
  status: "pending" | "approved" | "rejected" | "paused" | "disabled" | "deleted";
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
  /** Its top, a place, or none (text-parts.ts); and its reply buttons. */
  header: TextHeader | null;
  buttons: TextButton[];
  /** When it last went, and to how many; none if it never has. */
  lastUsedAt: Date | null;
  lastUsedTo: number;
  /** When the soonest broadcast scheduled with it goes; none if none is. */
  nextScheduledAt: Date | null;
  /** How many broadcasts have it: sent, or stopped once sending; scheduled or sending; and drafts. */
  uses: TemplateUses;
};

/** How many broadcasts have a template, by how far they've got. */
export type TemplateUses = { sent: number; scheduled: number; drafts: number };

export type WrittenBroadcast = WrittenMailing & {
  /** The subject, for an email; for a text, its template's name or its first words. */
  title: string;
  channel: BroadcastChannel;
  /** The topics whose yes it goes under, in TOPICS' order (BroadcastTerms). */
  topics: Topic[];
  template: WhatsAppTemplate | null;
  /** A text's top, the place its map shows or its picture, and its buttons (text-parts.ts). */
  header: TextHeader | null;
  place: TextPlace | null;
  pictureId: string | null;
  buttons: TextButton[];
  /** A text's second version, for those who meet its condition, with its template; none for one version. */
  textVersion: (TextVersion & { template: WhatsAppTemplate | null }) | null;
  /** What sends it, for an email (lib/broadcasts/broadcasts.ts, BROADCAST_SEND_BY). */
  sendBy: BroadcastSendBy;
  /** When it stops if it hasn't all gone, in minutes after its time; none for the most (sendingStopsAt). */
  finishMinutes: number | null;
  /**
   * Since when it's waited for CiviCRM, and why; or that it stopped by
   * itself, and why (StopReason in broadcast-sending.server.ts).
   */
  waitingSince: Date | null;
  waitReason: "civicrm" | "pull" | "approval" | "limit" | "template" | "late" | "failing" | null;
  /**
   * What CiviCRM's check last said, as it failed, while it waits for it; null otherwise. The words of how it failed
   * (wait_failure, a keptError), or for a wait from before that was kept, the words alone (wait_said).
   */
  waitSaid: string | null;
  gaveUp: boolean;
};

/**
 * Whether broadcast `m` has template `t`, for its own words or its second
 * version's, in a query with both.
 */
const ON_TEMPLATE = `(m.template_id = t.id
  OR EXISTS (SELECT 1 FROM broadcast_versions v WHERE v.mailing_id = m.id AND v.template_id = t.id))`;

const SELECT_TEMPLATES = `
  SELECT t.id::int AS id, t.name, t.body, t.status, t.category, t.meta_name AS "metaName", t.created_by AS "createdBy", t.approved_at AS "approvedAt", t.created_at AS "requestedAt",
    t.rejected_at AS "rejectedAt", t.rejected_reason AS "rejectedReason", t.footer, t.header, t.buttons,
    u.at AS "lastUsedAt", coalesce(u.n, 0)::int AS "lastUsedTo",
    (SELECT min(m.due_at) FROM mailings m WHERE ${ON_TEMPLATE} AND m.state = 'scheduled') AS "nextScheduledAt",
    (SELECT json_build_object(
       'sent', count(*) FILTER (WHERE m.state IN ('sent', 'cancelled')),
       'scheduled', count(*) FILTER (WHERE m.state IN ('scheduled', 'sending')),
       'drafts', count(*) FILTER (WHERE m.state = 'draft'))
     FROM mailings m WHERE ${ON_TEMPLATE}) AS uses
  FROM whatsapp_templates t LEFT JOIN LATERAL (
    SELECT m.due_at AS at, (SELECT count(*) FROM broadcast_messages c WHERE c.mailing_id = m.id) AS n
    FROM mailings m WHERE ${ON_TEMPLATE} AND m.state IN ('sending', 'sent', 'cancelled')
    ORDER BY m.due_at DESC LIMIT 1) u ON true`;

/**
 * The templates WhatsApp has approved, by the later of when each was
 * approved and last used, the latest first: so one just approved, such as a
 * template's words edited, is first, as is one just used.
 */
export async function approvedTemplates(): Promise<WhatsAppTemplate[]> {
  return query<WhatsAppTemplate>(
    `${SELECT_TEMPLATES} WHERE t.status = 'approved' ORDER BY greatest(u.at, t.approved_at) DESC, t.id DESC`,
  );
}

/**
 * Two approved templates a text has gone out on together, its own and its
 * second version's, for those who meet `condition`: chosen again as one, as
 * neither is the whole text alone. `title` is the newest such text's.
 */
export type TemplatePair = { own: number; version: number; condition: string; title: string };

/** Each pair of approved templates a text has had, with the newest text's title, newest first. */
export async function templatePairs(): Promise<TemplatePair[]> {
  return query<TemplatePair>(
    `SELECT own, version, condition, title FROM (
       SELECT DISTINCT ON (m.template_id, v.template_id, v.condition)
         m.template_id::int AS own, v.template_id::int AS version, v.condition, m.title, m.id
       FROM broadcast_versions v JOIN mailings m ON m.id = v.mailing_id
       JOIN whatsapp_templates o ON o.id = m.template_id AND o.status = 'approved'
       JOIN whatsapp_templates t ON t.id = v.template_id AND t.status = 'approved'
       WHERE m.template_id <> v.template_id
       ORDER BY m.template_id, v.template_id, v.condition, m.id DESC
     ) p ORDER BY id DESC`,
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
  const [{ templateId, ...own }] = await query<
    Pick<
      WrittenBroadcast,
      | "title"
      | "channel"
      | "topics"
      | "sendBy"
      | "finishMinutes"
      | "waitingSince"
      | "waitReason"
      | "waitSaid"
      | "gaveUp"
      | "header"
      | "place"
      | "pictureId"
      | "buttons"
    > & {
      templateId: number | null;
    }
  >(
    `SELECT title, channel, ${TOPICS_OF} AS topics, template_id::int AS "templateId", send_by AS "sendBy",
       header, place, picture_id AS "pictureId", buttons,
       finish_minutes AS "finishMinutes", waiting_since AS "waitingSince",
       wait_reason AS "waitReason", coalesce(wait_failure->>'said', wait_said) AS "waitSaid", gave_up AS "gaveUp"
     FROM mailings WHERE id = $1`,
    [id],
  );
  const templateOf = async (id: number | null) => {
    const [template = null] = id ? await query<WhatsAppTemplate>(`${SELECT_TEMPLATES} WHERE t.id = $1`, [id]) : [];
    return template;
  };
  const [version] = await query<TextVersion>(
    `SELECT condition, body, template_id::int AS "templateId", header, place, picture_id AS "pictureId", buttons
     FROM broadcast_versions WHERE mailing_id = $1`,
    [id],
  );
  return {
    ...written,
    ...own,
    template: await templateOf(templateId),
    textVersion: version ? { ...version, template: await templateOf(version.templateId) } : null,
  };
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
      `INSERT INTO mailings (title, audience, channel, topic, also_topics, filter, body, created_by, sent_from, from_name, state,
         send_by)
       VALUES ('', 'supporters', $1, $2, $8, $3, $4, $5, $6, $7, 'draft', $9) RETURNING id::int AS id`,
      [
        terms.channel,
        topicColumns(terms)[0],
        JSON.stringify(filter),
        JSON.stringify({ type: "doc", content: [] }),
        by,
        sentFrom,
        fromName,
        topicColumns(terms)[1],
        DEFAULT_SEND_BY,
      ],
      db,
    );
    await logChange(by, "create broadcast", { id, ...terms }, db);
    return id;
  });
}

/**
 * Makes a draft that copies broadcast `id`, by `by`: who it's to, so its
 * channel and topics, and its words, title, template and what sends it, and
 * a text's top, place, buttons and second version;
 * not when it goes, or its files. Who it's from is a new draft's
 * (senderOf). Returns the draft's ID; undefined for no such broadcast.
 */
export async function copyBroadcast(id: number, by: string): Promise<number | undefined> {
  const from = await getWrittenBroadcast(id);
  if (!from) return undefined;
  // A broadcast's filter always has its Consent, so a draft can be made from it.
  const copy = (await createBroadcastDraft(by, from.filter.params))!;
  await query(
    `UPDATE mailings m SET subject = s.subject, title = s.title, body = s.body, template_id = s.template_id,
       send_by = s.send_by, header = s.header, place = s.place, picture_id = s.picture_id, buttons = s.buttons
     FROM mailings s WHERE m.id = $1 AND s.id = $2`,
    [copy, id],
  );
  await query(
    `INSERT INTO broadcast_versions (mailing_id, condition, body, template_id, header, place, picture_id, buttons)
     SELECT $1, condition, body, template_id, header, place, picture_id, buttons
     FROM broadcast_versions WHERE mailing_id = $2`,
    [copy, id],
  );
  return copy;
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
 * keeping its other filters and the consents it leaves out. To the other channel only while it has no words
 * of its own (hasWords), starting it afresh as one new on that channel is.
 * Says the draft's version it made, for its writer to save at next, or
 * false if it didn't change it.
 */
export async function changeBroadcastConsent(id: number, value: string, by: string): Promise<number | false> {
  const broadcast = await getWrittenBroadcast(id);
  const terms = choiceTerms(value);
  if (broadcast?.state !== "draft" || !terms) return false;
  const moving = terms.channel !== broadcast.channel;
  if (moving && hasWords({ ...broadcast, templateId: broadcast.template?.id ?? null })) return false;
  const filter = storedFilter("supporters", {
    ...broadcast.filter.params,
    contact: [...termsValues(terms), ...consentLeftOut(broadcast.filter.params.contact)],
  });
  const sender = await senderOf(terms.channel);
  const [{ version }] = await query<{ version: number }>(
    `UPDATE mailings SET channel = $2, topic = $3, filter = $4, also_topics = $8,
       subject = CASE WHEN $5 THEN '' ELSE subject END,
       body = CASE WHEN $5 THEN '{"type": "doc", "content": []}'::jsonb ELSE body END,
       title = CASE WHEN $5 THEN '' ELSE title END,
       template_id = CASE WHEN $5 THEN NULL ELSE template_id END,
       header = CASE WHEN $5 THEN NULL ELSE header END,
       place = CASE WHEN $5 THEN NULL ELSE place END,
       picture_id = CASE WHEN $5 THEN NULL ELSE picture_id END,
       buttons = CASE WHEN $5 THEN '[]'::jsonb ELSE buttons END,
       sent_from = CASE WHEN $5 THEN $6 ELSE sent_from END,
       from_name = CASE WHEN $5 THEN $7 ELSE from_name END,
       version = version + 1, updated_at = now()
     WHERE id = $1 RETURNING version::int AS version`,
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
  if (moving) await query("DELETE FROM broadcast_versions WHERE mailing_id = $1", [id]);
  await logChange(by, "change broadcast consent", { id, ...terms });
  return version;
}

/** Whether a filter's terms are the broadcast's own. */
export function sameTerms(terms: BroadcastTerms | undefined, broadcast: BroadcastTerms): boolean {
  return terms?.channel === broadcast.channel && terms.topics.join() === broadcast.topics.join();
}

/** What a save of a broadcast can change: a mailing's, and a text's second version, or none (null) to take it away. */
export type BroadcastChanges = MailingChanges & { textVersion?: TextVersion | null };

/**
 * A save's changes as the writer sends them, if each is what it should be
 * for the channel. Neither says the address or the name it's from, which
 * are fixed (senderOf). An email may say what sends it, of what can now
 * (isAvailableSendBy). A text has no subject, may name a
 * template, or null for none, and may have a title of its own, as it has no
 * subject to be one; and its top, place, reply buttons and second version
 * (text-parts.ts). Either may say when it finishes, in whole minutes
 * after its time, one it can have (finishFits), or null for the most.
 */
export function broadcastChangesFrom(value: unknown, channel: BroadcastChannel): BroadcastChanges | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const { templateId, title, sendBy, finishMinutes, header, place, pictureId, buttons, textVersion, ...rest } =
    value as Record<string, unknown>;
  const parsed = mailingChangesFrom(rest);
  if (!parsed || "ask" in parsed || "sentFrom" in parsed || "fromName" in parsed) return undefined;
  if (
    finishMinutes !== undefined &&
    !(finishMinutes === null || (Number.isInteger(finishMinutes) && finishFits(finishMinutes as number)))
  ) {
    return undefined;
  }
  const changes: BroadcastChanges =
    finishMinutes === undefined ? parsed : { ...parsed, finishMinutes: finishMinutes as number | null };
  const textOnly = [templateId, title, header, place, pictureId, buttons, textVersion];
  if (channel === "email") {
    if (textOnly.some((one) => one !== undefined)) return undefined;
    if (sendBy === undefined) return changes;
    return isAvailableSendBy(sendBy) ? { ...changes, sendBy } : undefined;
  }
  if (sendBy !== undefined || "subject" in changes) return undefined;
  if (title !== undefined && typeof title !== "string") return undefined;
  if (templateId !== undefined && !(typeof templateId === "number" || templateId === null)) return undefined;
  const parts = {
    header: header === undefined ? undefined : headerFrom(header),
    place: place === undefined ? undefined : placeFrom(place),
    pictureId: pictureId === undefined ? undefined : pictureFrom(pictureId),
    buttons: buttons === undefined ? undefined : buttonsFrom(buttons),
    textVersion: textVersion === undefined ? undefined : versionFrom(textVersion),
  };
  const given = { title, templateId, header, place, pictureId, buttons, textVersion };
  // Each given, and each a proper one: a part that's given but undefined once checked isn't.
  if (Object.entries(parts).some(([name, one]) => one === undefined && given[name as keyof typeof given] !== undefined))
    return undefined;
  const text: BroadcastChanges = { ...changes };
  for (const [name, one] of Object.entries({ title, templateId, ...parts })) {
    if (one !== undefined) Object.assign(text, { [name]: one });
  }
  return text;
}

/** Whether changes would change what a template WhatsApp is reviewing says: its words, top or buttons. */
const changesTemplate = (changes: BroadcastChanges): boolean =>
  ["body", "templateId", "header", "buttons"].some((name) => name in changes);

/**
 * Saves changes to a draft broadcast at `version`. Choosing a template takes
 * its words, top, buttons and name, unless a title is given too; a text's
 * new words are named as staff name them. A text's second version is saved
 * whole, or taken away, with the rest; choosing a template for it takes its
 * words, top and buttons. Nothing WhatsApp is reviewing can change, but a
 * place, which isn't the template's.
 */
export async function saveBroadcastDraft(
  broadcast: WrittenBroadcast,
  version: number,
  changes: BroadcastChanges,
): Promise<SaveResult> {
  const { textVersion, ...own } = changes;
  if (broadcast.channel === "email") return saveDraft(broadcast.id, version, own);
  const before = broadcast.textVersion;
  // Words WhatsApp is reviewing stay as they were sent.
  if (broadcast.template?.status === "pending" && changesTemplate(own)) return { saved: false, reason: "conflict" };
  if (
    before?.template?.status === "pending" &&
    textVersion !== undefined &&
    (textVersion === null ||
      textVersion.condition !== before.condition ||
      textVersion.templateId !== before.templateId ||
      !sameTemplate(textVersion, before))
  ) {
    return { saved: false, reason: "conflict" };
  }
  const approved = await approvedTemplates();
  const chosen = (id: number | null | undefined) => (id ? approved.find((one) => one.id === id) : undefined);
  // The version is saved whole, so it names its template whether or not it's chosen now: one it has already, in
  // whatever state, stays.
  const versionChose = textVersion?.templateId !== before?.templateId && textVersion?.templateId;
  if ((own.templateId && !chosen(own.templateId)) || (versionChose && !chosen(versionChose))) {
    return { saved: false, reason: "conflict" };
  }
  const template = chosen(own.templateId);
  const mine: MailingChanges = template
    ? {
        ...own,
        body: checkMailingDoc(template.body)!,
        header: template.header,
        buttons: template.buttons,
        title: own.title ?? template.name,
      }
    : own;
  const theirs = chosen(textVersion?.templateId);
  const next =
    textVersion && theirs
      ? { ...textVersion, body: checkMailingDoc(theirs.body)!, header: theirs.header, buttons: theirs.buttons }
      : textVersion;
  if (next === undefined) return saveDraft(broadcast.id, version, mine);
  return transaction(async (db) => {
    const saved = await saveDraft(broadcast.id, version, mine, db);
    if (!saved.saved) return saved;
    if (next === null) await query("DELETE FROM broadcast_versions WHERE mailing_id = $1", [broadcast.id], db);
    else {
      await query(
        `INSERT INTO broadcast_versions (mailing_id, condition, body, template_id, header, place, buttons, picture_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (mailing_id) DO UPDATE SET condition = $2, body = $3, template_id = $4, header = $5, place = $6,
           buttons = $7, picture_id = $8`,
        [
          broadcast.id,
          next.condition,
          JSON.stringify(next.body),
          next.templateId,
          next.header,
          next.place && JSON.stringify(next.place),
          JSON.stringify(next.buttons),
          next.pictureId,
        ],
        db,
      );
    }
    return saved;
  });
}

export type BroadcastScheduleResult =
  | { scheduled: true }
  | { scheduled: false; problems: BroadcastScheduleProblem[] }
  | { scheduled: false; reason: "conflict" | "not-draft" | "gone" }
  /** A text's new words, which scheduling sends for approval, that didn't go: why (submitTemplate). */
  | { scheduled: false; submit: Exclude<TemplateSubmitResult, "submitted"> };

/**
 * How what sends a broadcast stands, for the page to say and for scheduling
 * to check: whether it goes by Gmail, and then whether the Gmail it's from
 * is connected; and how many more it can send today, and each day after,
 * null for no limit: emails by Gmail's limit, texts by our WhatsApp
 * number's, counted by this site, the only thing that sends from it, as
 * Meta doesn't say how many it has used.
 */
export async function broadcastSender(
  broadcast: Pick<WrittenBroadcast, "channel" | "sendBy" | "sentFrom">,
): Promise<{ byGmail: boolean; connected: boolean; remaining: number | null; daily: number | null }> {
  if (broadcast.channel !== "email") {
    const daily = (await textBackend())?.number.dailyLimit ?? null;
    return { byGmail: false, connected: false, remaining: await textsLeftToday(daily), daily };
  }
  const byGmail = broadcast.sendBy === "gmail";
  const { channel } = broadcastEmailChannel(broadcast.sendBy);
  const [connected, remaining] = await Promise.all([
    byGmail ? gmailAccount(broadcast.sentFrom!) : undefined,
    channel.remainingToday(broadcast.sentFrom!),
  ]);
  return { byGmail, connected: Boolean(connected), remaining, daily: remaining === null ? null : GMAIL_DAILY_LIMIT };
}

/** What stops a broadcast being scheduled, as it's stored, and how many it would go to now. */
async function scheduleProblems(
  broadcast: WrittenBroadcast,
): Promise<{ problems: BroadcastScheduleProblem[]; recipients: number }> {
  const [audience, unknown, sender, number, templates] = await Promise.all([
    supporterAudience(broadcast.filter, broadcast),
    filterProblems(broadcast.filter),
    broadcastSender(broadcast),
    textSenderNumber(),
    query<{ body: MailingDoc }>("SELECT body FROM whatsapp_templates WHERE status = 'approved'"),
  ]);
  const approvedWords = templates.map((template) => template.body);
  const version = broadcast.textVersion;
  const problems = broadcastScheduleProblems({
    ...broadcast,
    sameWords: sameWords(broadcast.body, approvedWords),
    recipients: audience.recipients.length,
    unknown,
    ...sender,
    approved: broadcast.template?.status === "approved",
    numbered: Boolean(number),
    sends: channelSends(broadcast.channel, broadcast.sendBy),
    textVersion: version && {
      ...version,
      approved: version.template?.status === "approved",
      sameWords: sameWords(version.body, approvedWords),
    },
  });
  return { problems, recipients: audience.recipients.length };
}

/**
 * Schedules a draft broadcast at `version`, if nothing stops it. Who it goes to
 * isn't fixed: sending finds them, a message each, keeping their name, place
 * and merge values, which erasing them deletes. A text goes only on a
 * template WhatsApp has approved: one with new words has them sent for
 * approval first (submitTemplate), which leaves its version as it was, and
 * is scheduled once WhatsApp has taken them, to wait for its approval
 * (startDueBroadcasts); if WhatsApp doesn't take them, it stays a draft, and
 * says why.
 */
export async function scheduleBroadcast(id: number, version: number, by: string): Promise<BroadcastScheduleResult> {
  const checked = await transaction(async (db): Promise<BroadcastScheduleResult | "submit"> => {
    const refused = await lockDraft(id, version, db, "supporters");
    if (refused) return { scheduled: false, reason: refused };
    const broadcast = (await getWrittenBroadcast(id))!;
    const { problems, recipients } = await scheduleProblems(broadcast);
    if (problems.length) return { scheduled: false, problems };
    // New words, never sent or rejected: with no problems, it has words (no-template).
    if (broadcast.channel === "text" && !["approved", "pending"].includes(broadcast.template?.status ?? "")) {
      return "submit";
    }
    await markScheduled(id, db);
    // Who it goes to isn't kept: sending finds them, so it reaches whoever the filters find then.
    await logChange(by, "schedule broadcast", { id, recipients }, db);
    return { scheduled: true };
  });
  if (checked !== "submit") return checked;
  const submitted = await submitTemplate(id, by);
  if (submitted !== "submitted") return { scheduled: false, submit: submitted };
  // Its words now wait for WhatsApp, so this time it's scheduled.
  return scheduleBroadcast(id, version, by);
}

/**
 * Stops a broadcast: a scheduled one becomes a draft again; one sending
 * sends no more; one all sent but for emails Postmark delayed (DELAYED)
 * waits for them no longer, so they count as errors, as they do once its
 * days run out. Either of the first two waits for CiviCRM no longer, so
 * scheduled again it has its days to wait afresh (waitStopsAt). Says
 * whether it stopped.
 */
export async function stopBroadcast(id: number, by: string): Promise<boolean> {
  return transaction(async (db) => {
    const [broadcast] = await query<{ state: string; delayed: boolean }>(
      `SELECT m.state, EXISTS (SELECT 1 FROM broadcast_messages c WHERE c.mailing_id = m.id AND ${DELAYED}) AS delayed
       FROM mailings m WHERE m.id = $1 AND m.audience = 'supporters' FOR UPDATE OF m`,
      [id],
      db,
    );
    if (broadcast?.state === "scheduled") {
      await markUnscheduled(id, db);
    } else if (broadcast?.state === "sending" || (broadcast?.state === "sent" && broadcast.delayed)) {
      await query(
        "UPDATE broadcast_messages SET status = 'cancelled' WHERE status = 'scheduled' AND mailing_id = $1",
        [id],
        db,
      );
      await markCancelled(id, db);
    } else {
      return false;
    }
    await query(
      "UPDATE mailings SET waiting_since = NULL, wait_reason = NULL, wait_said = NULL, wait_failure = NULL WHERE id = $1",
      [id],
      db,
    );
    await logChange(by, "stop broadcast", { id, was: broadcast.state }, db);
    return true;
  });
}

/**
 * Changes a broadcast's times (Change the times). One scheduled: when it
 * goes, to a run still to come, waiting for nothing at its new time, as
 * rescheduleMailing has it; one sending keeps its time. Either: how long after
 * its time it keeps trying (`finishMinutes`), one of FINISH_CHOICES or null for
 * the most, and only to a time still to come. Says whether it did.
 */
export async function retimeBroadcast(
  id: number,
  dueAt: Date | undefined,
  finishMinutes: number | null,
  by: string,
): Promise<boolean> {
  if (!finishFits(finishMinutes)) return false;
  return transaction(async (db) => {
    const [broadcast] = await query<{ state: string; dueAt: Date }>(
      `SELECT state, due_at AS "dueAt" FROM mailings
       WHERE id = $1 AND audience = 'supporters' AND state IN ('scheduled', 'sending') FOR UPDATE`,
      [id],
      db,
    );
    if (!broadcast) return false;
    const scheduled = broadcast.state === "scheduled";
    const due = scheduled ? dueAt : broadcast.dueAt;
    if (!due || (scheduled && sendsAt(due) <= now()) || sendingStopsAt({ dueAt: due, finishMinutes }) <= now()) {
      return false;
    }
    await query(
      `UPDATE mailings SET due_at = $2, finish_minutes = $3, updated_at = now(),
         waiting_since = CASE WHEN $4 THEN NULL ELSE waiting_since END,
         wait_reason = CASE WHEN $4 THEN NULL ELSE wait_reason END,
         wait_said = CASE WHEN $4 THEN NULL ELSE wait_said END,
         wait_failure = CASE WHEN $4 THEN NULL ELSE wait_failure END
       WHERE id = $1`,
      [id, due, finishMinutes, scheduled],
      db,
    );
    await logChange(by, "change broadcast times", { id, dueAt: due.toISOString(), finishMinutes }, db);
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
 * never started, it's scheduled again. From now, so it has the most time to go
 * in again (sendingStopsAt), whatever its finish was, and waiting for nothing, so its days to wait
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
      `UPDATE mailings SET state = $2, gave_up = false, waiting_since = NULL, wait_reason = NULL, wait_said = NULL, wait_failure = NULL, due_at = $3,
         finish_minutes = NULL,
         try_failed_at = NULL, failed_in_a_row = 0, held_back_since = NULL, held_back_told = false, updated_at = now()
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

/** Why WhatsApp didn't take new words: its own reason, or null when it gave none or wasn't reached. */
export type TemplateNotTaken = { failed: string | null };

export type TemplateSubmitResult =
  "submitted" | "no-words" | "not-ready" | "already" | "not-text" | "not-draft" | "gone" | TemplateNotTaken;

/** Why the site didn't send new words to WhatsApp for approval, as its action answers it: a reason each, which the writer has words for. */
export type TemplateRefusal = Exclude<TemplateSubmitResult, "submitted" | TemplateNotTaken>;

/** Whether WhatsApp took new words sent for approval, as the action answers it; if not, its own reason (TemplateNotTaken). */
export type TemplateTaken = { taken: true } | { taken: false; said: string | null };

/**
 * Whether a draft was scheduled, as the action answers it; if not, as
 * WhatsApp didn't take the new words scheduling sends it, its own reason
 * (TemplateNotTaken).
 */
export type BroadcastScheduled = { scheduled: true } | { scheduled: false; said: string | null };

/** A template going to WhatsApp for approval: its ID here, the name WhatsApp has it by, and what it says. */
type ForApproval = TextTemplateParts & { id: number; metaName: string; pictureId: string | null };

/** What a template is made from: a version's words, top and buttons, and its picture for an example. */
type Parts = TextTemplateParts & { pictureId: string | null };

/**
 * Sends a template's words to WhatsApp for approval, as a marketing
 * template in British English, each field a named parameter with an
 * example, the footer every text has, saying a reply of stop stops it, and
 * its top and buttons, reply buttons first; a picture's top with the
 * text's picture uploaded as its example, through the Meta app
 * (uploadExample). Keeps WhatsApp's ID for it. Gives null if WhatsApp took
 * them, else why not, reporting it; none can go with no Meta app set.
 */
async function sendForApproval(template: ForApproval): Promise<TemplateNotTaken | null> {
  const backend = await textBackend();
  if (!backend) return { failed: null };
  const footer = TEMPLATE_FOOTER;
  const appId = config.whatsappAppId;
  if (template.header === "image" && !appId) return { failed: null };
  try {
    const picture = template.header === "image" ? (await pictureOf(template.pictureId!))! : undefined;
    const header = picture
      ? {
          kind: "image" as const,
          example: await uploadExample(backend.keys, appId!, {
            name: `${template.metaName}.${picture.type === "image/png" ? "png" : "jpg"}`,
            type: picture.type,
            content: picture.content,
          }),
        }
      : template.header === "location"
        ? { kind: "location" as const }
        : undefined;
    const made = await createTemplate(backend.keys, {
      name: template.metaName,
      body: templateText(template.body),
      examples: templateParams(template.body, fakeRecipient(BROADCAST_FIELDS.map(hasField), "text")),
      footer,
      ...(header && { header }),
      buttons: inOrder(template.buttons).map((button) =>
        button.url === undefined ? { text: button.text.trim() } : { text: button.text.trim(), url: button.url.trim() },
      ),
    });
    // Its footer kept as it went, so every page shows what people got.
    await query("UPDATE whatsapp_templates SET meta_id = $2, footer = $3 WHERE id = $1", [
      template.id,
      made.id,
      footer,
    ]);
    return null;
  } catch (error) {
    problem(broadcastProblems.templateNotSent({ template: publicText(template.metaName) }), error);
    return { failed: error instanceof WhatsAppRequestError ? error.reason : null };
  }
}

/** Whether a version needs a template sent for approval: it has none, or WhatsApp rejected its. */
const needsTemplate = (template: WhatsAppTemplate | null): boolean => !template || template.status === "rejected";

/**
 * Sends a draft text's new words to WhatsApp for approval, as a new
 * template it then waits on: they can't be changed till WhatsApp decides,
 * or they're withdrawn. A text with a second version has a template for
 * each that needs one, but one for both when they'd be the same template
 * (sameTemplate). Each is called what the text is called, a second
 * version's with who it's for after. Emails who sent them and the
 * notification inbox the words. Not for words that are an approved
 * template, or waiting already, nor a text that anything but its time
 * would stop being scheduled. If WhatsApp doesn't take them all, they're
 * as they were, to send again, and it says why (`failed`).
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
    const version = broadcast.textVersion;
    const mine = needsTemplate(broadcast.template);
    const theirs = Boolean(version) && needsTemplate(version!.template);
    if (!mine && !theirs) return "already" as const;
    if (!hasWords({ subject: "", body: broadcast.body, templateId: null })) return "no-words" as const;
    // Only a text otherwise ready to schedule, so what WhatsApp approves is what goes.
    if (approvalProblems((await scheduleProblems(broadcast)).problems).length) return "not-ready" as const;
    // As staff named it: a text with no name isn't ready (approvalProblems).
    const name = broadcast.title.trim();
    const make = async (parts: Parts, called: string): Promise<ForApproval> => {
      const [{ templateId }] = await query<{ templateId: number }>(
        `INSERT INTO whatsapp_templates (name, body, status, created_by, header, buttons)
         VALUES ($1, $2, 'pending', $3, $4, $5) RETURNING id::int AS "templateId"`,
        [called, JSON.stringify(parts.body), by, parts.header, JSON.stringify(parts.buttons)],
        db,
      );
      const meta = metaName(called, templateId);
      await query("UPDATE whatsapp_templates SET meta_name = $2 WHERE id = $1", [templateId, meta], db);
      return {
        body: parts.body,
        header: parts.header,
        buttons: parts.buttons,
        pictureId: parts.pictureId,
        id: templateId,
        metaName: meta,
      };
    };
    const made: ForApproval[] = [];
    const add = async (parts: Parts, called: string): Promise<number> => {
      const one = await make(parts, called);
      made.push(one);
      return one.id;
    };
    // Each version's template says who it's for, but one for both, or for a text with one version, is just its name.
    const labels = version ? Object.fromEntries((await broadcastParts()).map((part) => [part.id, part.label])) : {};
    const who = version ? (labels[version.condition] ?? version.condition) : "";
    const split = Boolean(version) && !sameTemplate(version!, broadcast);
    const pages = broadcastsCopy.broadcastPages;
    // A name followed by who it's for, without the full stop a title can end with.
    let base = name;
    while (/[\s.!?,;:]$/.test(base)) base = base.slice(0, -1);
    const ownId = mine
      ? await add(broadcast, split ? pages.othersTemplateName(base, who) : name)
      : broadcast.template!.id;
    await query(
      "UPDATE mailings SET template_id = $2, title = $3, updated_at = now() WHERE id = $1",
      [id, ownId, name],
      db,
    );
    if (theirs) {
      const versionId = split ? await add(version!, pages.versionTemplateName(base, who)) : ownId;
      await query("UPDATE broadcast_versions SET template_id = $2 WHERE mailing_id = $1", [id, versionId], db);
    }
    return {
      made,
      before: { own: broadcast.template?.id ?? null, version: version?.templateId ?? null },
    };
  });
  if (typeof result === "string") return result;
  for (const [i, template] of result.made.entries()) {
    const notTaken = await sendForApproval(template);
    if (!notTaken) continue;
    // As it was before: the words back to change or send again, and the rejected templates they were on, if any;
    // and any WhatsApp took before this one taken back from it.
    await query("UPDATE mailings SET template_id = $2, updated_at = now() WHERE id = $1", [id, result.before.own]);
    await query("UPDATE broadcast_versions SET template_id = $2 WHERE mailing_id = $1", [id, result.before.version]);
    await withdrawAtWhatsApp(result.made.slice(0, i));
    await query("DELETE FROM whatsapp_templates WHERE id = ANY($1)", [result.made.map((one) => one.id)]);
    return notTaken;
  }
  const email = broadcastsCopy.notifications.templateSubmitted;
  for (const template of result.made) {
    const named = (await query<{ name: string }>("SELECT name FROM whatsapp_templates WHERE id = $1", [template.id]))[0]
      .name;
    await logChange(by, "submit broadcast template", { id, name: named });
    await notifyStaff(
      email.subject(named),
      email.body(by, templateWords(template.body), draftLink(id)),
      null,
      "staff-alert",
      by,
    );
  }
  return "submitted";
}

/**
 * Deletes templates sent for approval from WhatsApp, reporting any it won't
 * delete; not one with no name there, never sent.
 */
async function withdrawAtWhatsApp(templates: { metaName: string | null }[]): Promise<void> {
  const sent = templates.filter((template): template is { metaName: string } => Boolean(template.metaName));
  const backend = sent.length ? await textBackend() : undefined;
  for (const template of backend ? sent : []) {
    await orFallback(broadcastProblems.templateNotDeleted({ template: publicText(template.metaName) }), undefined, () =>
      deleteTemplate(backend!.keys, template.metaName),
    );
  }
}

/**
 * Takes back a draft text's words from WhatsApp's review, so they can be
 * changed, deleting them at WhatsApp too: its own and its second version's,
 * those waiting. If deleting one there fails, it's reported, and whatever
 * WhatsApp decides of it is ignored. Says whether it did.
 */
export async function withdrawTemplate(id: number, by: string): Promise<boolean> {
  const withdrawn = await transaction(async (db) => {
    const [mailing] = await query(
      "SELECT 1 FROM mailings WHERE id = $1 AND audience = 'supporters' AND state = 'draft' FOR UPDATE",
      [id],
      db,
    );
    const waiting = mailing
      ? await query<{ id: number; metaName: string | null }>(
          `SELECT t.id::int AS id, t.meta_name AS "metaName" FROM whatsapp_templates t
           WHERE t.status = 'pending' AND (t.id = (SELECT template_id FROM mailings WHERE id = $1)
             OR t.id = (SELECT template_id FROM broadcast_versions WHERE mailing_id = $1))`,
          [id],
          db,
        )
      : [];
    if (!waiting.length) return [];
    const ids = waiting.map((template) => template.id);
    await query(
      "UPDATE mailings SET template_id = NULL, updated_at = now() WHERE id = $1 AND template_id = ANY($2)",
      [id, ids],
      db,
    );
    await query(
      "UPDATE broadcast_versions SET template_id = NULL WHERE mailing_id = $1 AND template_id = ANY($2)",
      [id, ids],
      db,
    );
    await query("DELETE FROM whatsapp_templates WHERE id = ANY($1)", [ids], db);
    await logChange(by, "withdraw broadcast template", { id }, db);
    return waiting;
  });
  if (!withdrawn.length) return false;
  await withdrawAtWhatsApp(withdrawn);
  return true;
}

/** How deleting a template went: deleted; or not, as a broadcast has it, it's not approved now, or WhatsApp refused. */
export type TemplateDeleteResult = "deleted" | "used" | "gone" | "failed";

/**
 * Deletes approved template `id` from WhatsApp, and marks it deleted here,
 * where it's kept: only one no broadcast has ever had, draft or sent, as
 * one sent names it and takes its footer from it, and WhatsApp won't let a
 * new one take its name for 30 days. WhatsApp first, so nothing changes here
 * if it refuses.
 */
export async function deleteApprovedTemplate(id: number, by: string): Promise<TemplateDeleteResult> {
  return transaction(async (db) => {
    const [template] = await query<{ name: string; used: boolean }>(
      `SELECT coalesce(t.meta_name, t.name) AS name, EXISTS (SELECT 1 FROM mailings m WHERE ${ON_TEMPLATE}) AS used
       FROM whatsapp_templates t WHERE t.id = $1 AND t.status = 'approved' FOR UPDATE`,
      [id],
      db,
    );
    if (!template) return "gone";
    if (template.used) return "used";
    // With no keys, as on a deploy preview, nothing can reach WhatsApp.
    const backend = await textBackend();
    if (!backend) return "failed";
    const deleted = await orFallback(
      broadcastProblems.approvedNotDeleted({ template: publicText(template.name) }),
      "failed" as const,
      () => deleteTemplate(backend.keys, template.name),
    );
    if (deleted === "failed") return "failed";
    await query(
      "UPDATE whatsapp_templates SET status = 'deleted', deleted_at = now(), deleted_by = $2 WHERE id = $1",
      [id, by],
      db,
    );
    await logChange(by, "delete broadcast template", { id, name: template.name }, db);
    return "deleted";
  });
}

/** Whether a mailing has template $1, for its own words or its second version's, in a query of `mailings`. */
const HAS_TEMPLATE = "(template_id = $1 OR id IN (SELECT mailing_id FROM broadcast_versions WHERE template_id = $1))";

/** Who the audit log says made a text scheduled on a template WhatsApp rejected a draft again. */
const JOB_REVIEW = "whatsapp";

/** What WhatsApp decided about a template: approved, or rejected and why, by its code (INVALID_FORMAT), which is kept. */
export type TemplateReview = { approved: true } | { approved: false; reason: string };

/**
 * Records WhatsApp's decision on a template waiting for it, as its webhook
 * or a check of its templates tells it, and emails whoever sent it and the
 * notification inbox, with the words and the texts on them. An approved
 * template's texts can be scheduled, and one scheduled goes at its time, or
 * at once if that's passed; a rejected one's words can be changed and sent
 * again, so a text scheduled on it is a draft again, waiting for nothing.
 * Says whether there was one waiting.
 */
export async function reviewTemplate(templateId: number, review: TemplateReview): Promise<boolean> {
  const reviewed = await transaction(async (db) => {
    const [template] = await query<{ name: string; body: MailingDoc; createdBy: string | null }>(
      `UPDATE whatsapp_templates SET status = $2,
         approved_at = CASE WHEN $2 = 'approved' THEN now() END,
         rejected_at = CASE WHEN $2 = 'rejected' THEN now() END, rejected_reason = $3
       WHERE id = $1 AND status = 'pending' RETURNING name, body, created_by AS "createdBy"`,
      [templateId, review.approved ? "approved" : "rejected", review.approved ? null : review.reason],
      db,
    );
    if (!template) return undefined;
    const unscheduled = review.approved
      ? []
      : await query<{ id: number }>(
          `UPDATE mailings SET state = 'draft', waiting_since = NULL, wait_reason = NULL, version = version + 1,
             updated_at = now()
           WHERE ${HAS_TEMPLATE} AND state = 'scheduled' RETURNING id::int AS id`,
          [templateId],
          db,
        );
    for (const { id } of unscheduled) await logChange(JOB_REVIEW, "unschedule broadcast", { id, templateId }, db);
    return { template, unscheduled: unscheduled.length };
  });
  if (!reviewed) return false;
  const { template, unscheduled } = reviewed;
  const texts = await query<{ id: number }>(`SELECT id::int AS id FROM mailings WHERE ${HAS_TEMPLATE} ORDER BY id`, [
    templateId,
  ]);
  const words = templateWords(template.body);
  const links = texts.map((text) => draftLink(text.id));
  const copy = broadcastsCopy.notifications;
  const [subject, body] = review.approved
    ? [copy.templateApproved.subject(template.name), copy.templateApproved.body(words, links)]
    : [
        copy.templateRejected.subject(template.name),
        copy.templateRejected.body(rejectionWords(review.reason), words, links, unscheduled),
      ];
  await notifyStaff(subject, body, null, "staff-alert", template.createdBy ?? undefined);
  return true;
}

/**
 * Sends `to` one recipient's copy of a draft, as they'd get it, whatever the
 * recipient's permissions: an email by what the broadcast goes by, Postmark
 * or hello@'s Gmail, with its files and unsubscribe links that change
 * nothing (testLinks); a text by the backend, only on an approved template,
 * as WhatsApp sends no other. Undefined when it can't go.
 */
export async function sendBroadcastTest(
  broadcast: WrittenBroadcast,
  recipient: FakeRecipient,
  to: string,
): Promise<ChannelResult | undefined> {
  if (broadcast.channel === "email") {
    const sender = { sentFrom: BROADCAST_SENDER.email, fromName: BROADCAST_SENDER.name };
    const message = broadcastEmail(
      { ...broadcast, ...sender },
      { address: to, values: recipient },
      testLinks(),
      await attachmentsOf(broadcast.id),
    );
    return broadcastEmailChannel(broadcast.sendBy).channel.send(message, "mailing-test");
  }
  // The version they'd get, as sending chooses it (textSender).
  const version = broadcast.textVersion;
  const theirs = version && recipient.meets.includes(version.condition) ? version : broadcast;
  if (theirs.template?.status !== "approved") return undefined;
  const backend = await textBackend();
  if (!backend) return undefined;
  const template = theirs.template;
  return textResult(
    await sendTemplate(backend.keys, backend.number.id, to, {
      name: template.metaName ?? template.name,
      params: templateParams(template.body, recipient),
      ...(theirs.header === "location" && theirs.place && { place: theirs.place }),
      ...(theirs.header === "image" && theirs.pictureId && { picture: pictureAddress(theirs.pictureId) }),
    }),
  );
}
