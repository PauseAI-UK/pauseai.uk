import "server-only";
import { checkMailingDoc, isBlankMailing, letterFor, type MailingDoc } from "@/lib/mailings/doc";
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
import { query, transaction, type Queryable } from "@/lib/server/db.server";
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

/**
 * A template variant: its words, the kind of header it has and its buttons,
 * as WhatsApp approves them. One row at WhatsApp, or words not yet sent
 * there (a draft).
 */
export type WhatsAppVariant = {
  id: number;
  /** What it went to WhatsApp as, for staff to read; none for a draft. */
  name: string | null;
  body: MailingDoc;
  /**
   * Not yet sent (draft); waiting for WhatsApp, approved, rejected; or, once
   * approved, paused or disabled by WhatsApp for its quality, or deleted by
   * staff.
   */
  status: "draft" | "pending" | "approved" | "rejected" | "paused" | "disabled" | "deleted";
  /** What WhatsApp approved it as, which may not be what it was sent as; null till it has. */
  category: "MARKETING" | "UTILITY" | "AUTHENTICATION" | null;
  /** The name WhatsApp has it by, for one sent from here; one made in WhatsApp Manager has its own name there. */
  metaName: string | null;
  /** Who sent it for approval, or wrote a draft; none for one made in WhatsApp Manager. */
  createdBy: string | null;
  approvedAt: Date | null;
  /** When it was sent to WhatsApp for approval, or made in WhatsApp Manager. */
  requestedAt: Date;
  rejectedAt: Date | null;
  rejectedReason: string | null;
  /** Its footer as it went to WhatsApp, or none for one made in WhatsApp Manager. */
  footer: string | null;
  /** The kind of header it has, a place or a picture, or none (text-parts.ts); and its buttons. */
  header: TextHeader | null;
  buttons: TextButton[];
};

/**
 * A WhatsApp template, as staff name and pick it: one variant for everyone;
 * or, with a condition, a conditional variant for those who meet it and the
 * default one for everyone else. The two may be the same variant, where
 * only what their headers show differs.
 */
export type WhatsAppTemplate = {
  id: number;
  name: string;
  condition: string | null;
  default: WhatsAppVariant;
  conditional: WhatsAppVariant | null;
  /** Who made it, or none for one made in WhatsApp Manager. */
  createdBy: string | null;
  /** When WhatsApp approved the last of its variants. */
  approvedAt: Date | null;
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
  /** The subject, for an email; for a WhatsApp broadcast, its template's name. */
  title: string;
  channel: BroadcastChannel;
  /** The topics whose yes it goes under, in TOPICS' order (BroadcastTerms). */
  topics: Topic[];
  /**
   * A WhatsApp broadcast's template, which has its words; none till it has
   * any. `listed` once WhatsApp has approved every variant, so it can be
   * chosen for other broadcasts and no longer changes.
   */
  template: { id: number; name: string; condition: string | null; listed: boolean } | null;
  /** Its default variant, and that variant's words, header kind and buttons (text-parts.ts). */
  variant: WhatsAppVariant | null;
  header: TextHeader | null;
  buttons: TextButton[];
  /** What the default variant's header shows in this broadcast: a place, or a picture. */
  place: TextPlace | null;
  pictureId: string | null;
  /** Its conditional variant, for those who meet the condition, the same; none for a template with one variant. */
  textVersion: (TextVersion & { variant: WhatsAppVariant }) | null;
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

/** A variant's columns, from table alias `v`, each named with `prefix` (variantFrom). */
const variantColumns = (v: string, prefix: string): string =>
  `${v}.id::int AS "${prefix}Id", ${v}.name AS "${prefix}Name", ${v}.body AS "${prefix}Body", ${v}.status AS "${prefix}Status",
   ${v}.category AS "${prefix}Category", ${v}.meta_name AS "${prefix}MetaName", ${v}.created_by AS "${prefix}CreatedBy",
   ${v}.approved_at AS "${prefix}ApprovedAt", ${v}.created_at AS "${prefix}RequestedAt", ${v}.rejected_at AS "${prefix}RejectedAt",
   ${v}.rejected_reason AS "${prefix}RejectedReason", ${v}.footer AS "${prefix}Footer", ${v}.header AS "${prefix}Header",
   ${v}.buttons AS "${prefix}Buttons"`;

const VARIANT_FIELDS = [
  "id",
  "name",
  "body",
  "status",
  "category",
  "metaName",
  "createdBy",
  "approvedAt",
  "requestedAt",
  "rejectedAt",
  "rejectedReason",
  "footer",
  "header",
  "buttons",
] as const;

/** The variant a row has under `prefix` (variantColumns), or none where the row has none there. */
function variantFrom(row: Record<string, unknown>, prefix: string): WhatsAppVariant | null {
  if (row[`${prefix}Id`] === null) return null;
  return Object.fromEntries(
    VARIANT_FIELDS.map((name) => [name, row[`${prefix}${name[0].toUpperCase()}${name.slice(1)}`]]),
  ) as WhatsAppVariant;
}

/** Whether template `t`, with its variants `d` and `c`, is one WhatsApp has approved every variant of. */
const LISTED = "d.status = 'approved' AND (c.id IS NULL OR c.status = 'approved')";

/** Whether a template in a query of `whatsapp_templates` has variant $1. */
const HAS_VARIANT = "(default_variant_id = $1 OR conditional_variant_id = $1)";

const SELECT_TEMPLATES = `
  SELECT t.id::int AS id, t.name, t.condition, t.created_by AS "createdBy",
    ${variantColumns("d", "default")}, ${variantColumns("c", "conditional")},
    CASE WHEN ${LISTED} THEN greatest(d.approved_at, c.approved_at) END AS "approvedAt",
    u.at AS "lastUsedAt", coalesce(u.n, 0)::int AS "lastUsedTo",
    (SELECT min(m.due_at) FROM mailings m WHERE m.template_id = t.id AND m.state = 'scheduled') AS "nextScheduledAt",
    (SELECT json_build_object(
       'sent', count(*) FILTER (WHERE m.state IN ('sent', 'cancelled')),
       'scheduled', count(*) FILTER (WHERE m.state IN ('scheduled', 'sending')),
       'drafts', count(*) FILTER (WHERE m.state = 'draft'))
     FROM mailings m WHERE m.template_id = t.id) AS uses
  FROM whatsapp_templates t JOIN whatsapp_template_variants d ON d.id = t.default_variant_id
    LEFT JOIN whatsapp_template_variants c ON c.id = t.conditional_variant_id
    LEFT JOIN LATERAL (
      SELECT m.due_at AS at, (SELECT count(*) FROM broadcast_messages b WHERE b.mailing_id = m.id) AS n
      FROM mailings m WHERE m.template_id = t.id AND m.state IN ('sending', 'sent', 'cancelled')
      ORDER BY m.due_at DESC LIMIT 1) u ON true`;

type TemplateRow = Omit<WhatsAppTemplate, "default" | "conditional"> & Record<string, unknown>;

/** A template as a row of SELECT_TEMPLATES has it. */
function templateFrom(row: TemplateRow): WhatsAppTemplate {
  const { id, name, condition, createdBy, approvedAt, lastUsedAt, lastUsedTo, nextScheduledAt, uses } = row;
  return {
    id,
    name,
    condition,
    createdBy,
    approvedAt,
    lastUsedAt,
    lastUsedTo,
    nextScheduledAt,
    uses,
    default: variantFrom(row, "default")!,
    conditional: variantFrom(row, "conditional"),
  };
}

/**
 * The templates WhatsApp has approved, every variant, by the later of when
 * each was approved and last used, the latest first: so one just approved,
 * such as a template's words edited, is first, as is one just used.
 */
export async function approvedTemplates(): Promise<WhatsAppTemplate[]> {
  const rows = await query<TemplateRow>(
    `${SELECT_TEMPLATES} WHERE ${LISTED} ORDER BY greatest(u.at, d.approved_at, c.approved_at) DESC, t.id DESC`,
  );
  return rows.map(templateFrom);
}

/** Template `id`, whatever its variants' states; undefined for none. */
export async function getTemplate(id: number, db?: Queryable): Promise<WhatsAppTemplate | undefined> {
  const [row] = await query<TemplateRow>(`${SELECT_TEMPLATES} WHERE t.id = $1`, [id], db);
  return row && templateFrom(row);
}

/** Whether WhatsApp has approved every variant of a template, so it's one to choose, which no longer changes. */
const isListed = (template: Pick<WhatsAppTemplate, "default" | "conditional">): boolean =>
  template.default.status === "approved" && (!template.conditional || template.conditional.status === "approved");

/** A broadcast's topics, in a query of `mailings`: its first (`topic`), then the others (`also_topics`). */
export const TOPICS_OF = "array_prepend(topic, also_topics)";

/** A broadcast's topics, as `mailings` keeps them: its first, and the others. */
const topicColumns = (terms: BroadcastTerms): [Topic, Topic[]] => [terms.topics[0], terms.topics.slice(1)];

/**
 * A broadcast written here, as stored; undefined for none, or a mailing to
 * politicians. A WhatsApp broadcast's words, header kind and buttons are its
 * template's variants', and what each header shows its own (broadcast_headers).
 */
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
    > & {
      templateId: number | null;
    }
  >(
    `SELECT title, channel, ${TOPICS_OF} AS topics, template_id::int AS "templateId", send_by AS "sendBy",
       finish_minutes AS "finishMinutes", waiting_since AS "waitingSince",
       wait_reason AS "waitReason", coalesce(wait_failure->>'said', wait_said) AS "waitSaid", gave_up AS "gaveUp"
     FROM mailings WHERE id = $1`,
    [id],
  );
  const template = templateId === null ? undefined : await getTemplate(templateId);
  const shown = await query<{ variant: "default" | "conditional"; place: TextPlace | null; pictureId: string | null }>(
    `SELECT variant, place, picture_id AS "pictureId" FROM broadcast_headers WHERE mailing_id = $1`,
    [id],
  );
  const headerOf = (variant: "default" | "conditional") => {
    const one = shown.find((row) => row.variant === variant);
    return { place: one?.place ?? null, pictureId: one?.pictureId ?? null };
  };
  const text = {
    template: null,
    variant: null,
    header: null,
    buttons: [],
    textVersion: null,
    ...headerOf("default"),
  };
  if (!template) return { ...written, ...own, ...text };
  const { default: first, conditional } = template;
  return {
    ...written,
    ...own,
    ...text,
    body: checkMailingDoc(first.body)!,
    template: { id: template.id, name: template.name, condition: template.condition, listed: isListed(template) },
    variant: first,
    header: first.header,
    buttons: first.buttons,
    textVersion: conditional && {
      condition: template.condition!,
      body: checkMailingDoc(conditional.body)!,
      header: conditional.header,
      buttons: conditional.buttons,
      ...headerOf("conditional"),
      variant: conditional,
    },
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
 * channel and topics, and its words, title and what sends it; a WhatsApp
 * broadcast's template, and what its headers show. A template still being
 * written is copied too, its draft variants its own, so changing one draft's
 * words leaves the other's. Not when it goes, or its files. Who it's from is
 * a new draft's (senderOf). Returns the draft's ID; undefined for no such
 * broadcast.
 */
export async function copyBroadcast(id: number, by: string): Promise<number | undefined> {
  const from = await getWrittenBroadcast(id);
  if (!from) return undefined;
  // A broadcast's filter always has its Consent, so a draft can be made from it.
  const copy = (await createBroadcastDraft(by, from.filter.params))!;
  await transaction(async (db) => {
    const template = from.template && (await copyOfTemplate(from.template.id, by, db));
    await query(
      `UPDATE mailings m SET subject = s.subject, title = s.title, body = s.body, template_id = $3, send_by = s.send_by
       FROM mailings s WHERE m.id = $1 AND s.id = $2`,
      [copy, id, template],
      db,
    );
    await query(
      `INSERT INTO broadcast_headers (mailing_id, variant, place, picture_id)
       SELECT $1, variant, place, picture_id FROM broadcast_headers WHERE mailing_id = $2`,
      [copy, id],
      db,
    );
  });
  return copy;
}

/** A draft variant with these words, header kind and buttons, written by `by`; its ID. */
async function addDraftVariant(parts: TextTemplateParts, by: string | null, db: Queryable): Promise<number> {
  const [{ id }] = await query<{ id: number }>(
    `INSERT INTO whatsapp_template_variants (body, status, created_by, header, buttons)
     VALUES ($1, 'draft', $2, $3, $4) RETURNING id::int AS id`,
    [JSON.stringify(parts.body), by, parts.header, JSON.stringify(parts.buttons)],
    db,
  );
  return id;
}

/**
 * The template another broadcast takes from one with template `id`: the
 * template itself once WhatsApp has approved every variant, as it no longer
 * changes; else a copy of it, with its draft variants copied and the rest
 * shared, so each broadcast's words are its own to change.
 */
async function copyOfTemplate(id: number, by: string, db: Queryable): Promise<number> {
  const template = (await getTemplate(id, db))!;
  if (isListed(template)) return id;
  const copied = new Map<number, number>();
  const copyOf = async (variant: WhatsAppVariant): Promise<number> => {
    if (variant.status !== "draft") return variant.id;
    if (!copied.has(variant.id)) copied.set(variant.id, await addDraftVariant(variant, by, db));
    return copied.get(variant.id)!;
  };
  const first = await copyOf(template.default);
  const second = template.conditional && (await copyOf(template.conditional));
  const [made] = await query<{ id: number }>(
    `INSERT INTO whatsapp_templates (name, condition, default_variant_id, conditional_variant_id, created_by)
     VALUES ($1, $2, $3, $4, $5) RETURNING id::int AS id`,
    [template.name, template.condition, first, second, by],
    db,
  );
  return made.id;
}

/**
 * Deletes what no broadcast has of templates still being written: a
 * template with a draft variant that no broadcast has, then each draft
 * variant no template has. Words WhatsApp has, or has had, are kept.
 */
export async function sweepDraftTemplates(db?: Queryable): Promise<void> {
  await query(
    `DELETE FROM whatsapp_templates t
     WHERE NOT EXISTS (SELECT 1 FROM mailings m WHERE m.template_id = t.id)
       AND EXISTS (SELECT 1 FROM whatsapp_template_variants v
                   WHERE v.id IN (t.default_variant_id, t.conditional_variant_id) AND v.status = 'draft')`,
    [],
    db,
  );
  await query(
    `DELETE FROM whatsapp_template_variants v
     WHERE v.status = 'draft'
       AND NOT EXISTS (SELECT 1 FROM whatsapp_templates t WHERE t.default_variant_id = v.id OR t.conditional_variant_id = v.id)`,
    [],
    db,
  );
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
  if (moving) {
    await query("DELETE FROM broadcast_headers WHERE mailing_id = $1", [id]);
    await sweepDraftTemplates();
  }
  await logChange(by, "change broadcast consent", { id, ...terms });
  return version;
}

/** Whether a filter's terms are the broadcast's own. */
export function sameTerms(terms: BroadcastTerms | undefined, broadcast: BroadcastTerms): boolean {
  return terms?.channel === broadcast.channel && terms.topics.join() === broadcast.topics.join();
}

/**
 * What a save of a broadcast can change: a mailing's; and for a WhatsApp
 * broadcast, what's written, as its page has it. Either an approved template
 * chosen (`templateId`), or its words: the template's name (`title`), the
 * default variant's words, header kind and buttons, and its conditional
 * variant, whole, or none (null) to take it away. And what each variant's
 * header shows in this broadcast, a place or a picture. The page names no
 * variant: the save works out which each one's words are (saveBroadcastDraft).
 */
export type BroadcastChanges = MailingChanges & {
  header?: TextHeader | null;
  buttons?: TextButton[];
  place?: TextPlace | null;
  pictureId?: string | null;
  textVersion?: TextVersion | null;
};

/**
 * A save's changes as the writer sends them, if each is what it should be
 * for the channel. Neither says the address or the name it's from, which
 * are fixed (senderOf). An email may say what sends it, of what can now
 * (isAvailableSendBy). A WhatsApp broadcast has no subject, may choose a
 * template, and may have a title, its template's name, as it has no subject
 * to be one; and its header kind, place, picture, buttons and conditional
 * variant (text-parts.ts). Either may say when it finishes, in whole minutes
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
  if (templateId !== undefined && typeof templateId !== "number") return undefined;
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

/** A variant's words, header kind and buttons. */
const partsOf = (variant: TextTemplateParts): TextTemplateParts => ({
  body: variant.body,
  header: variant.header,
  buttons: variant.buttons,
});

/**
 * The variant that one of a template's two places is to hold, for words,
 * a header kind and buttons as written (`parts`), given the variant there
 * now (`now`), if any. Its ID, and whether WhatsApp has approved it.
 *
 * - What WhatsApp is reviewing stays: the save has checked the words are
 *   still those.
 * - Words an approved variant has, with its header kind and buttons, are
 *   that variant, shared, so they never go for approval twice: the chosen
 *   template's (`chosen`), or the one there now, where more than one has
 *   them.
 * - Other words are a draft: the one there now, changed, while it's this
 *   broadcast's alone (`mine`), and so is one WhatsApp rejected, which keeps
 *   saying why till it's sent again; else a new one.
 */
async function variantFor(
  parts: TextTemplateParts,
  now: WhatsAppVariant | null,
  mine: boolean,
  approved: KnownVariant[],
  by: string,
  db: Queryable,
  chosen?: WhatsAppVariant | null,
): Promise<{ id: number; approved: boolean }> {
  if (now?.status === "pending") return { id: now.id, approved: false };
  const same = [chosen, now, ...approved].find((one) => one?.status === "approved" && sameTemplate(parts, one));
  if (same) return { id: same.id, approved: true };
  if (now && mine && (now.status === "draft" || now.status === "rejected")) {
    await query(
      "UPDATE whatsapp_template_variants SET body = $2, header = $3, buttons = $4 WHERE id = $1",
      [now.id, JSON.stringify(parts.body), parts.header, JSON.stringify(parts.buttons)],
      db,
    );
    return { id: now.id, approved: false };
  }
  return { id: await addDraftVariant(parts, by, db), approved: false };
}

/** Keeps what one variant's header shows in broadcast `id`: a place, a picture, or neither. */
async function keepHeader(
  id: number,
  variant: "default" | "conditional",
  shown: { place: TextPlace | null; pictureId: string | null },
  db: Queryable,
): Promise<void> {
  await query(
    `INSERT INTO broadcast_headers (mailing_id, variant, place, picture_id) VALUES ($1, $2, $3, $4)
     ON CONFLICT (mailing_id, variant) DO UPDATE SET place = $3, picture_id = $4`,
    [id, variant, shown.place && JSON.stringify(shown.place), shown.pictureId],
    db,
  );
}

/**
 * Saves changes to a draft broadcast at `version`. A WhatsApp broadcast's
 * words are its template's, so the save works out the template from what's
 * written, by one rule for each variant (variantFor):
 *
 * - An approved template chosen (`templateId`) is the broadcast's, whole,
 *   and names it.
 * - Otherwise each variant's words are found or kept as a variant. If
 *   WhatsApp has approved them all, and a template has just those variants
 *   and that condition, the broadcast is on that template. If not, it's on
 *   a template of its own, changed in place while only this broadcast has
 *   it, else made new.
 * - Nothing WhatsApp is reviewing can change: not its words, header kind or
 *   buttons, nor who a conditional variant is for, nor the template chosen.
 *   What a header shows, a place or a picture, can, as each send gives it.
 * - A broadcast with no words, name or conditional variant has no template.
 */
export async function saveBroadcastDraft(
  broadcast: WrittenBroadcast,
  version: number,
  changes: BroadcastChanges,
): Promise<SaveResult> {
  const { templateId, title, body, header, buttons, place, pictureId, textVersion, ...mailing } = changes;
  if (broadcast.channel === "email") return saveDraft(broadcast.id, version, { ...mailing, ...(body && { body }) });
  const written = [templateId, title, body, header, buttons, textVersion].some((one) => one !== undefined);
  const shows = place !== undefined || pictureId !== undefined || textVersion !== undefined;
  if (!written && !shows) return saveDraft(broadcast.id, version, mailing);
  const conflict: SaveResult = { saved: false, reason: "conflict" };
  const { id } = broadcast;
  return transaction(async (db) => {
    const refused = await lockDraft(id, version, db, "supporters");
    if (refused) return { saved: false, reason: refused };
    // As it's stored now, with the draft held, whatever the page's copy was read as.
    const stored = (await getWrittenBroadcast(id))!;
    const now = stored.template && (await getTemplate(stored.template.id, db));
    const waiting = [now?.default, now?.conditional].some((one) => one?.status === "pending");
    // An approved template chosen is where what's written starts from: its variants, condition and name.
    const chosen = templateId == null ? undefined : await getTemplate(templateId, db);
    if (templateId != null && (!chosen || !isListed(chosen) || waiting)) return conflict;
    const before = stored.textVersion;
    // What's written, as the save leaves it.
    const first = {
      ...partsOf(chosen ? chosen.default : stored),
      ...(body && { body }),
      ...(buttons && { buttons }),
      ...(header !== undefined && { header }),
    };
    const second: TextVersion | null =
      textVersion !== undefined
        ? textVersion
        : chosen
          ? chosen.conditional && {
              ...partsOf(chosen.conditional),
              condition: chosen.condition!,
              place: before?.place ?? null,
              pictureId: before?.pictureId ?? null,
            }
          : before;
    // What WhatsApp is reviewing stays as it was sent.
    if (now?.default.status === "pending" && !sameTemplate(first, now.default)) return conflict;
    if (
      now?.conditional?.status === "pending" &&
      (!second || second.condition !== now.condition || !sameTemplate(second, now.conditional))
    ) {
      return conflict;
    }
    const name = title ?? (chosen ? chosen.name : stored.title);
    let template: number | null = null;
    let called = name;
    if (name.trim() || !isBlankMailing(first.body) || second) {
      // Only this broadcast has its template, and it's still being written: its rows are this broadcast's to change.
      const [{ others }] = await query<{ others: number }>(
        "SELECT count(*)::int AS others FROM mailings WHERE template_id = $1 AND id <> $2",
        [now?.id ?? null, id],
        db,
      );
      const mine = Boolean(now) && !isListed(now!) && others === 0;
      const approved = await approvedVariants(db);
      const by = stored.createdBy;
      const one = await variantFor(first, now?.default ?? null, mine, approved, by, db, chosen?.default);
      // One variant for both where they'd be the same; else the conditional one's own.
      const apart = now?.conditional && now.conditional.id !== now.default.id ? now.conditional : null;
      const other = !second
        ? null
        : now?.conditional?.status === "pending"
          ? { id: now.conditional.id, approved: false }
          : sameTemplate(second, first)
            ? one
            : await variantFor(second, apart, mine, approved, by, db, chosen?.conditional);
      const condition = second?.condition ?? null;
      // With every variant approved, the template that has just those and that condition, if there is one: the one
      // chosen, or else the one it has now, where more than one does.
      const [same] =
        one.approved && (!other || other.approved)
          ? await query<{ id: number; name: string }>(
              `SELECT id::int AS id, name FROM whatsapp_templates
               WHERE default_variant_id = $1 AND conditional_variant_id IS NOT DISTINCT FROM $2
                 AND condition IS NOT DISTINCT FROM $3
               ORDER BY (id = $4) DESC, (id = $5) DESC, id LIMIT 1`,
              [one.id, other?.id ?? null, condition, chosen?.id ?? null, now?.id ?? null],
              db,
            )
          : [];
      if (same) {
        template = same.id;
        called = same.name;
      } else if (mine) {
        await query(
          `UPDATE whatsapp_templates SET name = $2, condition = $3, default_variant_id = $4, conditional_variant_id = $5
           WHERE id = $1`,
          [now!.id, name, condition, one.id, other?.id ?? null],
          db,
        );
        template = now!.id;
      } else {
        const [made] = await query<{ id: number }>(
          `INSERT INTO whatsapp_templates (name, condition, default_variant_id, conditional_variant_id, created_by)
           VALUES ($1, $2, $3, $4, $5) RETURNING id::int AS id`,
          [name, condition, one.id, other?.id ?? null, by],
          db,
        );
        template = made.id;
      }
    }
    await query("UPDATE mailings SET title = $2 WHERE id = $1", [id, called], db);
    if (place !== undefined || pictureId !== undefined) {
      await keepHeader(
        id,
        "default",
        {
          place: place === undefined ? stored.place : place,
          pictureId: pictureId === undefined ? stored.pictureId : pictureId,
        },
        db,
      );
    }
    if (second) await keepHeader(id, "conditional", second, db);
    else await query("DELETE FROM broadcast_headers WHERE mailing_id = $1 AND variant = 'conditional'", [id], db);
    const saved = await saveDraft(id, version, { ...mailing, templateId: template }, db);
    await sweepDraftTemplates(db);
    return saved;
  });
}

/** A variant as far as telling whose words are whose goes: its words, header kind and buttons, and its state. */
type KnownVariant = TextTemplateParts & Pick<WhatsAppVariant, "id" | "status">;

/** The variants WhatsApp has approved, the oldest first. */
async function approvedVariants(db?: Queryable): Promise<KnownVariant[]> {
  return query<KnownVariant>(
    `SELECT id::int AS id, status, body, header, buttons FROM whatsapp_template_variants
     WHERE status = 'approved' ORDER BY id`,
    [],
    db,
  );
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
    approvedVariants(),
  ]);
  const approvedWords = templates.map((template) => template.body);
  const version = broadcast.textVersion;
  const problems = broadcastScheduleProblems({
    ...broadcast,
    sameWords: sameWords(broadcast.body, approvedWords),
    recipients: audience.recipients.length,
    unknown,
    ...sender,
    approved: broadcast.variant?.status === "approved",
    numbered: Boolean(number),
    sends: channelSends(broadcast.channel, broadcast.sendBy),
    textVersion: version && {
      ...version,
      approved: version.variant.status === "approved",
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
    // A WhatsApp broadcast with a variant WhatsApp has neither approved nor is reviewing: its words go for approval
    // first. With no problems, it has words (no-template), so a default variant to hold them.
    if (
      broadcast.channel === "text" &&
      [broadcast.variant!, ...(broadcast.textVersion ? [broadcast.textVersion.variant] : [])].some(
        (one) => !["approved", "pending"].includes(one.status),
      )
    ) {
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
  "submitted" | "no-words" | "not-ready" | "no-app" | "already" | "not-text" | "not-draft" | "gone" | TemplateNotTaken;

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

/** A variant going to WhatsApp for approval: its ID here, the name WhatsApp has it by, and what it says. */
type ForApproval = TextTemplateParts & { id: number; metaName: string; pictureId: string | null };

/**
 * Sends a variant's words to WhatsApp for approval, as a marketing
 * template in British English, each field a named parameter with an
 * example, the footer every one has, saying a reply of stop stops it, and
 * its header and buttons, reply buttons first; a picture header with the
 * broadcast's picture uploaded as its example, through the Meta app
 * (uploadExample), which submitTemplate has checked is set. Keeps
 * WhatsApp's ID for it. Gives null if WhatsApp took them, else why not,
 * reporting it.
 */
async function sendForApproval(template: ForApproval): Promise<TemplateNotTaken | null> {
  const backend = await textBackend();
  if (!backend) return { failed: null };
  const footer = TEMPLATE_FOOTER;
  try {
    const picture = template.header === "image" ? (await pictureOf(template.pictureId!))! : undefined;
    const header = picture
      ? {
          kind: "image" as const,
          example: await uploadExample(backend.keys, config.whatsappAppId!, {
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
    await query("UPDATE whatsapp_template_variants SET meta_id = $2, footer = $3 WHERE id = $1", [
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

/** Whether a variant's words are still to go to WhatsApp: a draft, or ones it rejected. */
const toSend = (variant: WhatsAppVariant | null | undefined): boolean =>
  variant?.status === "draft" || variant?.status === "rejected";

/**
 * Sends a draft WhatsApp broadcast's new words to WhatsApp for approval:
 * each of its template's variants that's a draft, or that WhatsApp
 * rejected, goes as a new variant, which then waits, and can't be changed
 * till WhatsApp decides or it's withdrawn. Each is called what the template
 * is called, with who it's for after where the template has two. Emails who
 * sent them and the notification inbox the words. Not for a template with
 * nothing to send, nor a broadcast that anything but its time would stop
 * being scheduled, nor one with a picture while the site has no Meta app to
 * upload its example through ("no-app"), which is reported. If WhatsApp
 * doesn't take them all, they're as they were, to send again, and it says
 * why (`failed`).
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
    const first = broadcast.variant;
    const second = version && version.variant.id !== first?.id ? version.variant : null;
    if (!hasWords({ subject: "", body: broadcast.body, templateId: null })) return "no-words" as const;
    if (!toSend(first) && !toSend(second)) return "already" as const;
    // Only a broadcast otherwise ready to schedule, so what WhatsApp approves is what goes.
    if (approvalProblems((await scheduleProblems(broadcast)).problems).length) return "not-ready" as const;
    // A picture goes to WhatsApp through the Meta app: without one, no new variant with a picture can be sent.
    const pictured = [first, second].some((one) => toSend(one) && one!.header === "image");
    if (pictured && !config.whatsappAppId) {
      problem(broadcastProblems.noMetaApp());
      return "no-app" as const;
    }
    // As staff named it: a template with no name isn't ready (approvalProblems).
    const name = broadcast.title.trim();
    // Each variant says who it's for, where the template has two; one for both, or for everyone, is just its name.
    const labels = second ? Object.fromEntries((await broadcastParts()).map((part) => [part.id, part.label])) : {};
    const who = version ? (labels[version.condition] ?? version.condition) : "";
    const pages = broadcastsCopy.broadcastPages;
    // A name followed by who it's for, without the full stop a title can end with.
    let base = name;
    while (/[\s.!?,;:]$/.test(base)) base = base.slice(0, -1);
    const made: ForApproval[] = [];
    const sent = async (from: WhatsAppVariant, called: string, pictureId: string | null): Promise<number> => {
      const [{ variant }] = await query<{ variant: number }>(
        `INSERT INTO whatsapp_template_variants (name, body, status, created_by, header, buttons)
         VALUES ($1, $2, 'pending', $3, $4, $5) RETURNING id::int AS variant`,
        [called, JSON.stringify(from.body), by, from.header, JSON.stringify(from.buttons)],
        db,
      );
      const meta = metaName(called, variant);
      await query("UPDATE whatsapp_template_variants SET meta_name = $2 WHERE id = $1", [variant, meta], db);
      made.push({ ...partsOf(from), id: variant, metaName: meta, pictureId });
      return variant;
    };
    const one = toSend(first)
      ? await sent(first!, second ? pages.othersTemplateName(base, who) : name, broadcast.pictureId)
      : first!.id;
    const other = !version
      ? null
      : !second
        ? one
        : toSend(second)
          ? await sent(second, pages.versionTemplateName(base, who), version.pictureId)
          : second.id;
    const template = broadcast.template!;
    await query(
      "UPDATE whatsapp_templates SET name = $2, default_variant_id = $3, conditional_variant_id = $4 WHERE id = $1",
      [template.id, name, one, other],
      db,
    );
    await query("UPDATE mailings SET title = $2, updated_at = now() WHERE id = $1", [id, name], db);
    return {
      made,
      template: template.id,
      before: { one: first!.id, other: version ? version.variant.id : null },
    };
  });
  if (typeof result === "string") return result;
  for (const [i, variant] of result.made.entries()) {
    const notTaken = await sendForApproval(variant);
    if (!notTaken) continue;
    // As it was before: the words back to change or send again, and any WhatsApp took before this one taken back
    // from it.
    await query("UPDATE whatsapp_templates SET default_variant_id = $2, conditional_variant_id = $3 WHERE id = $1", [
      result.template,
      result.before.one,
      result.before.other,
    ]);
    await query("UPDATE mailings SET updated_at = now() WHERE id = $1", [id]);
    await withdrawAtWhatsApp(result.made.slice(0, i));
    await query("DELETE FROM whatsapp_template_variants WHERE id = ANY($1)", [result.made.map((one) => one.id)]);
    return notTaken;
  }
  // The drafts they were sent from are done with; one WhatsApp rejected is kept, as what it rejected.
  await sweepDraftTemplates();
  const email = broadcastsCopy.notifications.templateSubmitted;
  for (const variant of result.made) {
    const named = (
      await query<{ name: string }>("SELECT name FROM whatsapp_template_variants WHERE id = $1", [variant.id])
    )[0].name;
    await logChange(by, "submit broadcast template", { id, name: named });
    await notifyStaff(
      email.subject(named),
      email.body(by, templateWords(variant.body), draftLink(id)),
      null,
      "staff-alert",
      by,
    );
  }
  return "submitted";
}

/**
 * Deletes variants sent for approval from WhatsApp, reporting any it won't
 * delete; not one with no name there, never sent.
 */
async function withdrawAtWhatsApp(variants: { metaName: string | null }[]): Promise<void> {
  const sent = variants.filter((variant): variant is { metaName: string } => Boolean(variant.metaName));
  const backend = sent.length ? await textBackend() : undefined;
  for (const variant of backend ? sent : []) {
    await orFallback(broadcastProblems.templateNotDeleted({ template: publicText(variant.metaName) }), undefined, () =>
      deleteTemplate(backend!.keys, variant.metaName),
    );
  }
}

/**
 * Takes back a draft WhatsApp broadcast's words from WhatsApp's review, so
 * they can be changed, deleting them at WhatsApp too: each variant of its
 * template that's waiting is a draft again, with no name there. If
 * deleting one there fails, it's reported, and whatever WhatsApp decides
 * of it is ignored. Says whether it did.
 */
export async function withdrawTemplate(id: number, by: string): Promise<boolean> {
  const withdrawn = await transaction(async (db) => {
    const waiting = await query<{ id: number; metaName: string | null }>(
      `UPDATE whatsapp_template_variants v SET status = 'draft', name = NULL, meta_name = NULL, meta_id = NULL
       FROM (SELECT o.id, o.meta_name FROM whatsapp_template_variants o WHERE o.status = 'pending' FOR UPDATE) o,
         whatsapp_templates t, mailings m
       WHERE o.id = v.id AND v.id IN (t.default_variant_id, t.conditional_variant_id) AND m.template_id = t.id
         AND m.id = $1 AND m.audience = 'supporters' AND m.state = 'draft'
       RETURNING v.id::int AS id, o.meta_name AS "metaName"`,
      [id],
      db,
    );
    if (!waiting.length) return [];
    await query("UPDATE mailings SET updated_at = now() WHERE id = $1", [id], db);
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
 * Deletes approved template `id`: only one no broadcast has ever had,
 * draft or sent, as one sent names it and takes its footer from it. Each
 * of its variants that no other template has is deleted from WhatsApp, and
 * marked deleted here, where it's kept, as WhatsApp won't let a new one
 * take its name for 30 days. WhatsApp first, so nothing changes here if it
 * refuses.
 */
export async function deleteApprovedTemplate(id: number, by: string): Promise<TemplateDeleteResult> {
  return transaction(async (db) => {
    const [locked] = await query<{ used: boolean }>(
      `SELECT EXISTS (SELECT 1 FROM mailings m WHERE m.template_id = t.id) AS used
       FROM whatsapp_templates t WHERE t.id = $1 FOR UPDATE`,
      [id],
      db,
    );
    const template = locked && (await getTemplate(id, db));
    if (!template || !isListed(template)) return "gone";
    if (locked.used) return "used";
    const variants = await query<{ id: number; name: string }>(
      `SELECT v.id::int AS id, coalesce(v.meta_name, v.name) AS name FROM whatsapp_template_variants v
       WHERE v.id = ANY($1)
         AND NOT EXISTS (SELECT 1 FROM whatsapp_templates o
                         WHERE o.id <> $2 AND v.id IN (o.default_variant_id, o.conditional_variant_id))`,
      [[template.default.id, ...(template.conditional ? [template.conditional.id] : [])], id],
      db,
    );
    // With no keys, as on a deploy preview, nothing can reach WhatsApp.
    const backend = await textBackend();
    if (!backend) return "failed";
    for (const variant of variants) {
      const deleted = await orFallback(
        broadcastProblems.approvedNotDeleted({ template: publicText(variant.name) }),
        "failed" as const,
        () => deleteTemplate(backend.keys, variant.name),
      );
      if (deleted === "failed") return "failed";
    }
    await query("DELETE FROM whatsapp_templates WHERE id = $1", [id], db);
    await query(
      "UPDATE whatsapp_template_variants SET status = 'deleted', deleted_at = now(), deleted_by = $2 WHERE id = ANY($1)",
      [variants.map((variant) => variant.id), by],
      db,
    );
    await logChange(by, "delete broadcast template", { id, name: template.name }, db);
    return "deleted";
  });
}

/** Whether a mailing's template has variant $1, in a query of `mailings`. */
export const ON_VARIANT = `template_id IN (SELECT id FROM whatsapp_templates WHERE ${HAS_VARIANT})`;

/** Who the audit log says made a broadcast scheduled on a variant WhatsApp rejected a draft again. */
const JOB_REVIEW = "whatsapp";

/** What WhatsApp decided about a variant: approved, or rejected and why, by its code (INVALID_FORMAT), which is kept. */
export type TemplateReview = { approved: true } | { approved: false; reason: string };

/**
 * Records WhatsApp's decision on a variant waiting for it, as its webhook
 * or a check of its templates tells it, and emails whoever sent it and the
 * notification inbox, with the words and the broadcasts on them. An
 * approved variant's broadcasts can be scheduled, and one scheduled goes at
 * its time, or at once if that's passed; a rejected one's words can be
 * changed and sent again, so a broadcast scheduled on it is a draft again,
 * waiting for nothing. Says whether there was one waiting.
 */
export async function reviewTemplate(variantId: number, review: TemplateReview): Promise<boolean> {
  const reviewed = await transaction(async (db) => {
    const [variant] = await query<{ name: string; body: MailingDoc; createdBy: string | null }>(
      `UPDATE whatsapp_template_variants SET status = $2,
         approved_at = CASE WHEN $2 = 'approved' THEN now() END,
         rejected_at = CASE WHEN $2 = 'rejected' THEN now() END, rejected_reason = $3
       WHERE id = $1 AND status = 'pending' RETURNING name, body, created_by AS "createdBy"`,
      [variantId, review.approved ? "approved" : "rejected", review.approved ? null : review.reason],
      db,
    );
    if (!variant) return undefined;
    const unscheduled = review.approved
      ? []
      : await query<{ id: number }>(
          `UPDATE mailings SET state = 'draft', waiting_since = NULL, wait_reason = NULL, version = version + 1,
             updated_at = now()
           WHERE ${ON_VARIANT} AND state = 'scheduled' RETURNING id::int AS id`,
          [variantId],
          db,
        );
    for (const { id } of unscheduled)
      await logChange(JOB_REVIEW, "unschedule broadcast", { id, templateId: variantId }, db);
    return { variant, unscheduled: unscheduled.length };
  });
  if (!reviewed) return false;
  const { variant, unscheduled } = reviewed;
  const texts = await query<{ id: number }>(`SELECT id::int AS id FROM mailings WHERE ${ON_VARIANT} ORDER BY id`, [
    variantId,
  ]);
  const words = templateWords(variant.body);
  const links = texts.map((text) => draftLink(text.id));
  const copy = broadcastsCopy.notifications;
  const [subject, body] = review.approved
    ? [copy.templateApproved.subject(variant.name), copy.templateApproved.body(words, links)]
    : [
        copy.templateRejected.subject(variant.name),
        copy.templateRejected.body(rejectionWords(review.reason), words, links, unscheduled),
      ];
  await notifyStaff(subject, body, null, "staff-alert", variant.createdBy ?? undefined);
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
  if (theirs.variant?.status !== "approved") return undefined;
  const backend = await textBackend();
  if (!backend) return undefined;
  const template = theirs.variant;
  return textResult(
    await sendTemplate(backend.keys, backend.number.id, to, {
      name: template.metaName ?? template.name!,
      params: templateParams(template.body, recipient),
      ...(theirs.header === "location" && theirs.place && { place: theirs.place }),
      ...(theirs.header === "image" && theirs.pictureId && { picture: pictureAddress(theirs.pictureId) }),
    }),
  );
}
