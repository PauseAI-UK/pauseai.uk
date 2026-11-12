import "server-only";
import type { MailingDoc, MailingRecipientValues } from "@/lib/mailing-doc";
import { checkMailingDoc } from "@/lib/mailing-doc";
import type { MailingChoice } from "@/lib/mailing-fields";
import { mailingGroups, type MailingGroup } from "@/lib/mailing-groups";
import { now } from "@/lib/now";
import { storedFilter, type StoredFilter } from "@/lib/staff-search";
import { firstOf, pageNumber, type Params, type ParamValue } from "@/lib/list-params";
import { BROADCAST_SENDER, termsValues, type BroadcastChannel, type BroadcastTerms } from "@/lib/broadcasts";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Topic } from "@/lib/contact-permissions";
import { answersTo, type BroadcastAnswer } from "./broadcast-answers";
import { repliesTo, type BroadcastReply } from "./broadcast-replies";
import { query } from "./db";
import { gmailAccounts, type GmailAccount } from "./gmail-accounts";
import { isLettersInboxAddress } from "./letters-inbox";
import { channelSends, textSenderNumber } from "./broadcast-channels";
import {
  approvedTemplates,
  getWrittenBroadcast,
  type WhatsAppTemplate,
  type WrittenBroadcast,
} from "./broadcast-drafts";
import { broadcastChoices, broadcastParts, supporterAudience } from "./broadcast-recipients";
import type { MailingSummary } from "./mailings";
import { checkStoredFilter, filterProblems } from "./stored-filters";
import { supporterChoices, type SupporterChoices } from "./supporters";

// What the pages of broadcasts to supporters show: the list of them, a draft
// to write, one scheduled or sent with its recipients, and one copy as sent.
// To staff, broadcasts are apart from mailings, though both are rows
// of `mailings`, so this reads only those to supporters.

/** A broadcast in the list: a mailing's summary, with what only a broadcast has. */
export type BroadcastSummary = MailingSummary & {
  channel: BroadcastChannel;
  /** Copies its provider says arrived, of the `sent` that have gone. */
  delivered: number;
  read: number;
  /** A draft whose new words WhatsApp is reviewing. */
  waiting: boolean;
  /** A draft whose new words WhatsApp rejected, until they're sent again or a template's chosen. */
  rejected: boolean;
  /** Copies with a reply from a person, and of those, any still waiting for staff to look at. */
  toLookAt: number;
};

const WAS_READ = "EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'read')";
const BOUNCED = "EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'bounced')";
const OPTED_OUT =
  "EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'opted-out')";
const REPLIED = "EXISTS (SELECT 1 FROM broadcast_replies r WHERE r.message_id = c.id AND NOT r.automatic)";
const TO_LOOK_AT =
  "EXISTS (SELECT 1 FROM broadcast_replies r WHERE r.message_id = c.id AND NOT r.automatic AND r.outcome IS NULL)";
// Stopped: never sent, as the broadcast was stopped, they asked us to stop, or their consent ended before it
// went; or they asked us to stop after it arrived, so it counts as delivered too.
const STOPPED = `(c.status = 'cancelled' OR c.skip_reason IN ('unsubscribed', 'no-permission') OR ${OPTED_OUT})`;
const FAILED =
  "(c.status = 'failed' OR (c.status = 'skipped' AND c.skip_reason NOT IN ('unsubscribed', 'no-permission')))";

const SELECT_BROADCASTS = `
  SELECT m.id::int AS id, m.title, m.ask, NULL AS "askTitle", false AS imported, m.state, m.created_by AS "createdBy",
    coalesce(nullif(m.from_name, ''), m.sent_from) AS "fromName", m.sent_from AS "sentFrom", m.due_at AS "dueAt",
    m.updated_at AS "updatedAt", m.channel,
    EXISTS (SELECT 1 FROM whatsapp_templates t WHERE t.id = m.template_id AND t.status = 'pending') AS waiting,
    EXISTS (SELECT 1 FROM whatsapp_templates t WHERE t.id = m.template_id AND t.status = 'rejected') AS rejected,
    min(c.sent_at) AS "sentAt",
    count(c.id)::int AS "to",
    count(c.id) FILTER (WHERE c.status IN ('sent', 'delivered'))::int AS sent,
    count(c.id) FILTER (WHERE c.status = 'delivered')::int AS delivered,
    count(c.id) FILTER (WHERE ${FAILED})::int AS failed,
    count(c.id) FILTER (WHERE ${STOPPED})::int AS stopped,
    count(c.id) FILTER (WHERE ${WAS_READ})::int AS read,
    count(c.id) FILTER (WHERE ${REPLIED})::int AS replied,
    0 AS answered,
    count(c.id) FILTER (WHERE ${TO_LOOK_AT})::int AS "toLookAt"
  FROM mailings m LEFT JOIN broadcast_messages c ON c.mailing_id = m.id
  WHERE m.audience = 'supporters'`;

/** The page of broadcasts: what's coming up, and those sent under their months and years; and now, which says which year needn't be written. */
export async function broadcastsPage(): Promise<{ groups: MailingGroup<BroadcastSummary>[]; now: string }> {
  // A draft or one scheduled has no messages yet, so how many it goes to is who its filters find now.
  const [unsent, all] = await Promise.all([
    query<BroadcastSummary & { filter: unknown; topic: BroadcastTerms["topic"]; alsoEvents: boolean }>(
      `SELECT d.*, f.filter, f.topic, f.also_events AS "alsoEvents"
       FROM (${SELECT_BROADCASTS} AND m.state IN ('draft', 'scheduled') GROUP BY m.id) d
       JOIN (SELECT id::int AS id, filter, topic, also_events FROM mailings) f USING (id)
       ORDER BY d."updatedAt" DESC, d.id DESC`,
    ),
    query<BroadcastSummary>(
      `${SELECT_BROADCASTS} AND m.state NOT IN ('draft', 'scheduled') GROUP BY m.id
       ORDER BY min(c.sent_at) DESC NULLS FIRST, m.id DESC`,
    ),
  ]);
  const counted = await Promise.all(
    unsent.map(async ({ filter, topic, alsoEvents, ...broadcast }) => ({
      ...broadcast,
      to: (await supporterAudience(checkStoredFilter(filter)!, { channel: broadcast.channel, topic, alsoEvents }))
        .recipients.length,
    })),
  );
  const at = now();
  return {
    groups: mailingGroups(
      {
        drafts: counted.filter((m) => m.state === "draft"),
        comingUp: [...counted.filter((m) => m.state === "scheduled"), ...all.filter((m) => m.state === "sending")].sort(
          (a, b) => a.dueAt!.getTime() - b.dueAt!.getTime(),
        ),
        sent: all.filter((m) => m.state !== "sending"),
      },
      at,
    ),
    now: at.toISOString(),
  };
}

/** One recipient of a broadcast, on its page. */
export type MessageRecipient = {
  copyId: number;
  supporterId: number | null;
  /** None for someone erased since. */
  name: string | null;
  place: string | null;
  status: string;
  skipReason: string | null;
  sentAt: Date | null;
  read: boolean;
  /** An email that failed as it bounced. */
  bounced: boolean;
  /** They asked us to stop after it reached them. */
  optedOut: boolean;
  /** They replied, and staff have still to look at a reply. */
  replied: boolean;
  toLookAt: boolean;
};

/** Which of a broadcast's recipients its page lists. */
export const MESSAGE_TABS = ["all", "delivered", "failed", "stopped", "read", "replied", "look"] as const;
export type MessageTab = (typeof MESSAGE_TABS)[number];

const TAB_CONDITIONS: Record<MessageTab, string> = {
  all: "true",
  delivered: "c.status = 'delivered'",
  failed: FAILED,
  stopped: STOPPED,
  read: WAS_READ,
  replied: REPLIED,
  look: TO_LOOK_AT,
};

const RECIPIENTS_PAGE_SIZE = 100;

/** What writing a broadcast needs. */
export type BroadcastWriterData = {
  filter: StoredFilter;
  choices: SupporterChoices;
  /** The values of the filter the site no longer knows. */
  unknown: string[];
  /** How many it goes to; its preview is for someone made up (fakeRecipient), so none of them is sent. */
  count: number;
  fields: MailingChoice[];
  conditions: MailingChoice[];
  /** The connected Gmail accounts an email can be from instead. */
  senders: GmailAccount[];
  me: string;
  /** Whether this broadcast can be sent yet, by its channel. */
  sends: boolean;
  /** Whether a text can be sent yet, for the writer when Texts is picked. */
  textsSend: boolean;
  templates: WhatsAppTemplate[];
  /** The WhatsApp business account's number, if one is set. */
  textNumber: string | null;
};

export type BroadcastPageData =
  | ({ kind: "draft"; draft: WrittenBroadcast } & BroadcastWriterData)
  | {
      kind: "written";
      written: WrittenBroadcast;
      summary: BroadcastSummary;
      choices: SupporterChoices;
      /** What each part its words can be only for says, as its box shows it. */
      parts: Record<string, string>;
      tab: MessageTab;
      recipients: MessageRecipient[];
      recipientsTotal: number;
      page: number;
      pages: number;
      pageSize: number;
    };

async function writerData(draft: WrittenBroadcast, me: string): Promise<BroadcastWriterData> {
  const [audience, unknown, choices, senders, templates] = await Promise.all([
    supporterAudience(draft.filter, draft),
    filterProblems(draft.filter),
    supporterChoices(),
    gmailAccounts(),
    approvedTemplates(),
  ]);
  return {
    filter: draft.filter,
    choices,
    unknown,
    count: audience.recipients.length,
    fields: audience.fields,
    conditions: audience.conditions,
    // Never the letters inbox, which sends supporters' letters and nothing else.
    senders: senders.filter((sender) => !isLettersInboxAddress(sender.email)),
    me,
    sends: channelSends(draft.channel),
    textsSend: channelSends("text"),
    templates,
    textNumber: textSenderNumber(),
  };
}

/**
 * New broadcast, before its Consent is chosen: a writer for an email to
 * no one yet, with the staff member's Gmail and the other choices it will
 * have, for its greyed sections to show what's to come. Nothing is saved.
 */
export async function newBroadcastPageData(
  me: string,
): Promise<{ draft: WrittenBroadcast; data: BroadcastWriterData }> {
  const [choices, senders, templates, parts] = await Promise.all([
    supporterChoices(),
    gmailAccounts(),
    approvedTemplates(),
    broadcastParts(),
  ]);
  const filter = storedFilter("supporters", {});
  return {
    draft: {
      id: 0,
      filter,
      subject: "",
      body: { type: "doc", content: [] },
      ask: null,
      createdBy: me,
      sentFrom: BROADCAST_SENDER.email,
      fromName: BROADCAST_SENDER.name,
      dueAt: null,
      state: "draft",
      version: 0,
      attachments: [],
      title: "",
      channel: "email",
      topic: "newsletter",
      alsoEvents: false,
      aboutEvents: false,
      template: null,
      waitingSince: null,
      waitReason: null,
      gaveUp: false,
    },
    data: {
      filter,
      choices,
      unknown: [],
      count: 0,
      ...broadcastChoices([], parts),
      senders: senders.filter((sender) => !isLettersInboxAddress(sender.email)),
      me,
      sends: channelSends("email"),
      textsSend: channelSends("text"),
      templates,
      textNumber: textSenderNumber(),
    },
  };
}

/**
 * A broadcast's page: a draft, to write, which opening keeps from being tidied
 * away; or one scheduled or sent, with a page of its recipients in a tab; as
 * `me`, the staff member looking. Undefined for none.
 */
export async function broadcastPageData(
  id: number,
  search: { page?: ParamValue; tab?: ParamValue },
  me: string,
): Promise<BroadcastPageData | undefined> {
  const written = await getWrittenBroadcast(id, true);
  if (!written) return undefined;
  if (written.state === "draft") return { kind: "draft", draft: written, ...(await writerData(written, me)) };
  const tab = MESSAGE_TABS.find((one) => one === firstOf(search.tab)) ?? "all";
  const page = pageNumber(firstOf(search.page));
  const from = `FROM broadcast_messages c WHERE c.mailing_id = $1 AND ${TAB_CONDITIONS[tab]}`;
  const [[summary], recipients, [{ total }], choices, parts] = await Promise.all([
    query<BroadcastSummary>(`${SELECT_BROADCASTS} AND m.id = $1 GROUP BY m.id`, [id]),
    query<MessageRecipient>(
      `SELECT c.id::int AS "copyId", c.supporter_id::int AS "supporterId", c.merge_values ->> 'name' AS name,
         c.merge_values ->> 'place' AS place, c.status, c.skip_reason AS "skipReason", c.sent_at AS "sentAt",
         ${WAS_READ} AS read, ${BOUNCED} AS bounced, ${OPTED_OUT} AS "optedOut", ${REPLIED} AS replied,
         ${TO_LOOK_AT} AS "toLookAt"
       ${from} ORDER BY ${TO_LOOK_AT} DESC, (c.merge_values ->> 'name') COLLATE english NULLS LAST, c.id
       LIMIT $2 OFFSET $3`,
      [id, RECIPIENTS_PAGE_SIZE, (page - 1) * RECIPIENTS_PAGE_SIZE],
    ),
    query<{ total: number }>(`SELECT count(*)::int AS total ${from}`, [id]),
    supporterChoices(),
    broadcastParts(),
  ]);
  // One scheduled has no messages yet: it goes to whoever its filters find when it's sent, so for now, who they
  // find, a page at a time, each yet to be sent.
  const now = written.state === "scheduled" ? await scheduledRecipients(written, page) : undefined;
  const listed = now?.total ?? total;
  return {
    kind: "written",
    written,
    summary: { ...summary, to: now?.total ?? summary.to },
    choices,
    parts: Object.fromEntries(parts.map((part) => [part.id, part.label])),
    tab,
    recipients: now?.rows ?? recipients,
    recipientsTotal: listed,
    page,
    pages: Math.max(1, Math.ceil(listed / RECIPIENTS_PAGE_SIZE)),
    pageSize: RECIPIENTS_PAGE_SIZE,
  };
}

/** Who a scheduled broadcast's filters find now, by name, page `page` of them, as rows yet to be sent, and how many. */
async function scheduledRecipients(
  written: WrittenBroadcast,
  page: number,
): Promise<{ rows: MessageRecipient[]; total: number }> {
  const { recipients } = await supporterAudience(written.filter, written);
  const rows = [...recipients]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice((page - 1) * RECIPIENTS_PAGE_SIZE, page * RECIPIENTS_PAGE_SIZE)
    .map((one) => ({
      copyId: one.id,
      supporterId: one.id,
      name: one.name,
      place: one.place,
      status: "scheduled" as const,
      skipReason: null,
      sentAt: null,
      read: false,
      bounced: false,
      optedOut: false,
      replied: false,
      toLookAt: false,
    }));
  return { rows, total: recipients.length };
}

/** A broadcast's title, for its page's title, one with none said so; or undefined for no such broadcast. */
export async function broadcastTitle(id: number): Promise<string | undefined> {
  const [broadcast] = await query<{ title: string }>(
    "SELECT title FROM mailings WHERE id = $1 AND audience = 'supporters'",
    [id],
  );
  return broadcast && (broadcast.title || staffCopy.broadcastPages.untitled);
}

/**
 * A broadcast's step of the trail above its page: its title, or for a
 * draft, whose title changes as it's written, that it's a draft; or
 * undefined for no such broadcast.
 */
export async function broadcastCrumb(id: number): Promise<string | undefined> {
  const [broadcast] = await query<{ title: string; draft: boolean }>(
    "SELECT title, state = 'draft' AS draft FROM mailings WHERE id = $1 AND audience = 'supporters'",
    [id],
  );
  return broadcast && (broadcast.draft ? staffCopy.broadcastPages.draftCrumb : broadcast.title);
}

/** One supporter's copy of a broadcast. */
export type MessageCopy = {
  id: number;
  messageId: number;
  title: string;
  channel: BroadcastChannel;
  subject: string;
  body: MailingDoc;
  fromName: string;
  sentFrom: string;
  /** What's kept of them: none once they're erased. */
  supporterId: number | null;
  name: string | null;
  address: string | null;
  merge: MailingRecipientValues | null;
  status: string;
  skipReason: string | null;
  /** Where they are, as sending found it. */
  place: string | null;
  sentAt: Date | null;
  /** What its provider reported, newest first. */
  events: BroadcastEvent[];
  /** The topics it went under, which a reply recorded as an opt-out stops. */
  topics: Topic[];
  /** The replies to it, oldest first. */
  replies: BroadcastReply[];
  /** Staff's answers to those replies, oldest first. */
  answers: BroadcastAnswer[];
};

/** Something that happened to a copy, as its provider reported it. */
export type BroadcastEvent = { at: Date; kind: string; details: Record<string, unknown> };

/** One copy of a broadcast, by its broadcast's ID and its own; or undefined. */
export async function messageCopy(broadcastId: number, copyId: number): Promise<MessageCopy | undefined> {
  const [row] = await query<Omit<MessageCopy, "events" | "replies" | "answers">>(
    `SELECT c.id::int AS id, m.id::int AS "messageId", m.title, m.channel, m.subject, m.body,
       m.from_name AS "fromName", m.sent_from AS "sentFrom", c.supporter_id::int AS "supporterId",
       c.merge_values ->> 'name' AS name, c.merge_values ->> 'place' AS place, c.address,
       CASE WHEN c.merge_values ? 'values' THEN c.merge_values END AS merge, c.status, c.skip_reason AS "skipReason", c.sent_at AS "sentAt",
       c.topics
     FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE c.id = $2 AND m.id = $1 AND m.audience = 'supporters'`,
    [broadcastId, copyId],
  );
  if (!row) return undefined;
  const [events, replies, answers] = await Promise.all([
    query<BroadcastEvent>(
      "SELECT at, kind, details FROM broadcast_message_events WHERE message_id = $1 ORDER BY at DESC, id DESC",
      [copyId],
    ),
    repliesTo(copyId),
    answersTo(copyId),
  ]);
  return { ...row, body: checkMailingDoc(row.body)!, events, replies, answers };
}

/** A broadcast sent to a supporter, on their page. */
export type SupporterBroadcastRow = {
  copyId: number;
  messageId: number;
  title: string;
  channel: BroadcastChannel;
  status: string;
  skipReason: string | null;
  sentAt: Date | null;
  read: boolean;
  bounced: boolean;
  optedOut: boolean;
  replied: boolean;
};

/** The broadcasts a supporter was sent, newest first. */
export async function broadcastsToSupporter(supporterId: number): Promise<SupporterBroadcastRow[]> {
  return query<SupporterBroadcastRow>(
    `SELECT c.id::int AS "copyId", m.id::int AS "messageId", m.title, m.channel, c.status, c.skip_reason AS "skipReason",
       c.sent_at AS "sentAt", ${WAS_READ} AS read, ${BOUNCED} AS bounced, ${OPTED_OUT} AS "optedOut", ${REPLIED} AS replied
     FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE c.supporter_id = $1 ORDER BY c.sent_at DESC NULLS FIRST, c.id DESC`,
    [supporterId],
  );
}

/** The draft the supporters list is choosing who for. */
export type ChoosingBroadcast = Pick<WrittenBroadcast, "id" | "channel" | "topic"> &
  Partial<Pick<WrittenBroadcast, "alsoEvents">> & {
    title: string;
    /** Nothing written yet, as from New broadcast. */
    blank: boolean;
  };

/** The Consent a draft being chosen for goes under, as the list's Consent filter writes it: a value, or two for a pair. */
export function choosingConsent(choosing: ChoosingBroadcast): string | string[] {
  const values = termsValues(choosing);
  return values.length === 1 ? values[0] : values;
}

/**
 * The supporters list's filters, `params`, while it's choosing who the draft
 * `broadcast` names goes to: that draft, and its Consent over any other, as
 * the list can't change it. As they are, with no such draft.
 */
export async function withChoosing(
  params: Params,
  broadcast: ParamValue | undefined,
): Promise<{ choosing?: ChoosingBroadcast; params: Params }> {
  const choosing = await choosingBroadcast(firstOf(broadcast));
  return { choosing, params: choosing ? { ...params, contact: choosingConsent(choosing) } : params };
}

/** The draft the list's `broadcast` parameter names; undefined for none, or one no longer a draft. */
export async function choosingBroadcast(id: string): Promise<ChoosingBroadcast | undefined> {
  const draft = /^\d+$/.test(id) ? await getWrittenBroadcast(Number(id)) : undefined;
  if (draft?.state !== "draft") return undefined;
  return {
    id: draft.id,
    channel: draft.channel,
    topic: draft.topic,
    alsoEvents: draft.alsoEvents,
    title: draft.title || staffCopy.broadcastPages.newTitle[draft.channel],
    blank: !draft.title,
  };
}
