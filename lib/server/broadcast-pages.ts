import "server-only";
import type { MailingDoc, MailingRecipientValues } from "@/lib/mailing-doc";
import { checkMailingDoc } from "@/lib/mailing-doc";
import type { MailingChoice } from "@/lib/mailing-fields";
import { mailingGroups, type MailingGroup } from "@/lib/mailing-groups";
import { now } from "@/lib/now";
import { storedFilter, type StoredFilter } from "@/lib/staff-search";
import { firstOf, pageNumber, type Params, type ParamValue } from "@/lib/list-params";
import {
  BROADCAST_SENDER,
  termsValues,
  type BroadcastChannel,
  type BroadcastSendBy,
  type BroadcastTerms,
} from "@/lib/broadcasts";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Topic } from "@/lib/contact-permissions";
import { answersTo, type BroadcastAnswer } from "./broadcast-answers";
import { repliesTo, type BroadcastReply } from "./broadcast-replies";
import { query } from "./db";
import { channelSends, textSenderNumber } from "./broadcast-channels";
import {
  approvedTemplates,
  broadcastSender,
  TOPICS_OF,
  getWrittenBroadcast,
  type WhatsAppTemplate,
  type WrittenBroadcast,
} from "./broadcast-drafts";
import { broadcastChoices, broadcastParts, supporterAudience } from "./broadcast-recipients";
import type { MailingBase } from "./mailings";
import { howOptedOutFrom, optedOutFrom } from "./opt-outs";
import { checkStoredFilter, filterProblems } from "./stored-filters";
import { supporterChoices, type SupporterChoices } from "./supporters";

// What the pages of broadcasts to supporters show: the list of them, a draft
// to write, one scheduled or sent with its recipients, and one copy as sent.
// To staff, broadcasts are apart from mailings, though both are rows
// of `mailings`, so this reads only those to supporters.

/** A broadcast in the list: a mailing's summary, with what only a broadcast has. */
export type BroadcastSummary = MailingBase & {
  channel: BroadcastChannel;
  /** What sends an email; Gmail says nothing of what arrives, so its copies stay sent. */
  sendBy: BroadcastSendBy;
  /** A draft whose new words WhatsApp is reviewing. */
  waiting: boolean;
  /** A draft whose new words WhatsApp rejected, until they're sent again or a template's chosen. */
  rejected: boolean;
  /** One that stopped by itself, as it hadn't all gone in time, and why: limit, civicrm, pull or template. */
  gaveUp: boolean;
  waitReason: string | null;
  /** How many of its copies are in each state (COPY_STATES). */
  states: Record<(typeof COPY_STATES)[number], number>;
};

// Why a copy's broadcast stopped by itself, when it did (its wait_reason), so a copy it left unsent can say so.
const STOPPED_BY = "(SELECT CASE WHEN g.gave_up THEN g.wait_reason END FROM mailings g WHERE g.id = c.mailing_id)";
const WAS_READ = "EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'read')";
const BOUNCED = "EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'bounced')";
// They asked us to stop after it reached them: its provider said so (a WhatsApp stop, a spam complaint), or an
// opt-out was made from it (our link, their mail app's Unsubscribe, their reply).
const OPTED_OUT = `(EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'opted-out')
  OR ${optedOutFrom("c.id")})`;
// How they asked, from the first opt-out made from it.
const STOPPED_VIA = howOptedOutFrom("c.id");
const REPLIED = "EXISTS (SELECT 1 FROM broadcast_replies r WHERE r.message_id = c.id AND NOT r.automatic)";
const TO_LOOK_AT =
  "EXISTS (SELECT 1 FROM broadcast_replies r WHERE r.message_id = c.id AND NOT r.automatic AND r.outcome IS NULL)";
// A text's number WhatsApp said isn't on it when this copy went, rather than known before.
const FOUND_UNREACHABLE = "EXISTS (SELECT 1 FROM whatsapp_unreachable u WHERE u.message_id = c.id)";
// Its send cut off, so it may have gone (fail in broadcast-sending.ts).
const UNFINISHED = `EXISTS (SELECT 1 FROM broadcast_message_events e
  WHERE e.message_id = c.id AND e.kind = 'failed' AND e.details ? 'unfinished')`;

/**
 * Where a copy stands, one state each, the first that applies: a reply to
 * check; they opted out because of it; something broke (its provider
 * refused it, its send cut off, its broadcast gave up); it didn't reach them
 * (a bounce, or a number found not on WhatsApp); not sent, as expected (they'd
 * opted out before, their consent ended, an address already blocked, we
 * cancelled); replied; read; delivered; sent. Still to go: scheduled, or
 * sending. Each count and tab on a broadcast's page is one of these.
 */
export const COPY_STATES = [
  "look",
  "opted-out",
  "error",
  "unreached",
  "not-sent",
  "replied",
  "read",
  "delivered",
  "sent",
] as const;
export type CopyState = (typeof COPY_STATES)[number] | "scheduled" | "sending";

const COPY_STATE = `CASE
  WHEN ${TO_LOOK_AT} THEN 'look'
  WHEN c.status IN ('scheduled', 'sending') THEN c.status
  WHEN c.status IN ('sent', 'delivered') AND ${OPTED_OUT} THEN 'opted-out'
  WHEN (c.status = 'failed' AND NOT ${BOUNCED}) OR (c.status = 'cancelled' AND ${STOPPED_BY} IS NOT NULL) THEN 'error'
  WHEN c.status = 'failed' OR (c.skip_reason = 'not-on-whatsapp' AND ${FOUND_UNREACHABLE}) THEN 'unreached'
  WHEN c.status IN ('skipped', 'cancelled') THEN 'not-sent'
  WHEN ${REPLIED} THEN 'replied'
  WHEN ${WAS_READ} THEN 'read'
  WHEN c.status = 'delivered' THEN 'delivered'
  ELSE 'sent' END`;

// Why it's in its state, where that has a why: how they opted out; what broke (Gmail, Postmark or WhatsApp
// refusing it, a send cut off, or why its broadcast gave up); bounced or not on WhatsApp; why it wasn't sent (a
// skip reason, cancelled, or opted out in WhatsApp before).
const COPY_WHY = `CASE ${COPY_STATE}
  WHEN 'opted-out' THEN ${STOPPED_VIA}
  WHEN 'error' THEN coalesce(${STOPPED_BY}, CASE WHEN ${UNFINISHED} THEN 'unfinished'
    ELSE (SELECT CASE WHEN g.channel = 'text' THEN 'whatsapp' ELSE g.send_by END FROM mailings g WHERE g.id = c.mailing_id) END)
  WHEN 'unreached' THEN CASE WHEN ${BOUNCED} THEN 'bounced' ELSE 'not-on-whatsapp' END
  WHEN 'not-sent' THEN CASE WHEN c.status = 'cancelled' THEN 'cancelled'
    WHEN c.skip_reason = 'unsubscribed' AND ${STOPPED_VIA} = 'whatsapp-refused' THEN 'whatsapp'
    ELSE c.skip_reason END
  END`;

const SELECT_BROADCASTS = `
  SELECT m.id::int AS id, m.title, m.ask, NULL AS "askTitle", false AS imported, m.state, m.created_by AS "createdBy",
    coalesce(nullif(m.from_name, ''), m.sent_from) AS "fromName", m.sent_from AS "sentFrom", m.due_at AS "dueAt",
    m.updated_at AS "updatedAt", m.channel, m.send_by AS "sendBy",
    EXISTS (SELECT 1 FROM whatsapp_templates t WHERE t.id = m.template_id AND t.status = 'pending') AS waiting,
    EXISTS (SELECT 1 FROM whatsapp_templates t WHERE t.id = m.template_id AND t.status = 'rejected') AS rejected,
    m.gave_up AS "gaveUp", m.wait_reason AS "waitReason",
    min(c.sent_at) AS "sentAt",
    count(c.id)::int AS "to",
    -- As the sending bar counts them (MailingsOverview): those that went, and those done with but not sent.
    count(c.id) FILTER (WHERE c.status IN ('sent', 'delivered'))::int AS sent,
    count(c.id) FILTER (WHERE c.status IN ('failed', 'skipped', 'cancelled'))::int AS failed,
    0 AS answered,
    -- How many are in each state.
    json_build_object(${COPY_STATES.map((one) => `'${one}', count(c.id) FILTER (WHERE s.state = '${one}')`).join(", ")}) AS states
  FROM mailings m LEFT JOIN broadcast_messages c ON c.mailing_id = m.id
  LEFT JOIN LATERAL (SELECT ${COPY_STATE} AS state) s ON true
  WHERE m.audience = 'supporters'`;

/** The page of broadcasts: what's coming up, and those sent under their months and years; and now, which says which year needn't be written. */
export async function broadcastsPage(): Promise<{ groups: MailingGroup<BroadcastSummary>[]; now: string }> {
  // A draft or one scheduled has no messages yet, so how many it goes to is who its filters find now.
  const [unsent, all] = await Promise.all([
    query<BroadcastSummary & { filter: unknown; topics: BroadcastTerms["topics"] }>(
      `SELECT d.*, f.filter, f.topics
       FROM (${SELECT_BROADCASTS} AND m.state IN ('draft', 'scheduled') GROUP BY m.id) d
       JOIN (SELECT id::int AS id, filter, ${TOPICS_OF} AS topics FROM mailings) f USING (id)
       ORDER BY d."updatedAt" DESC, d.id DESC`,
    ),
    query<BroadcastSummary>(
      `${SELECT_BROADCASTS} AND m.state NOT IN ('draft', 'scheduled') GROUP BY m.id
       ORDER BY min(c.sent_at) DESC NULLS FIRST, m.id DESC`,
    ),
  ]);
  const counted = await Promise.all(
    unsent.map(async ({ filter, topics, ...broadcast }) => ({
      ...broadcast,
      to: (await supporterAudience(checkStoredFilter(filter)!, { channel: broadcast.channel, topics })).recipients
        .length,
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
  /** Where it stands (COPY_STATE), and why, where that state has one (COPY_WHY). */
  state: CopyState;
  why: string | null;
};

/** Which of a broadcast's recipients its page lists. */
export const MESSAGE_TABS = ["all", ...COPY_STATES] as const;
export type MessageTab = (typeof MESSAGE_TABS)[number];

/** Those a tab lists: everyone, or those in its state. */
const tabCondition = (tab: MessageTab): string => (tab === "all" ? "true" : `${COPY_STATE} = '${tab}'`);

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
  /** How what sends an email stands, for the draft as stored (broadcastSender). */
  sender: Awaited<ReturnType<typeof broadcastSender>>;
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
      /** Whether it's sending by what can send no more today, so the rest wait for tomorrow. */
      atLimit: boolean;
      recipients: MessageRecipient[];
      recipientsTotal: number;
      page: number;
      pages: number;
      pageSize: number;
    };

async function writerData(draft: WrittenBroadcast, me: string): Promise<BroadcastWriterData> {
  const [audience, unknown, choices, sender, templates] = await Promise.all([
    supporterAudience(draft.filter, draft),
    filterProblems(draft.filter),
    supporterChoices(),
    broadcastSender(draft),
    approvedTemplates(),
  ]);
  return {
    filter: draft.filter,
    choices,
    unknown,
    count: audience.recipients.length,
    fields: audience.fields,
    conditions: audience.conditions,
    sender,
    me,
    sends: channelSends(draft.channel, draft.sendBy),
    textsSend: channelSends("text"),
    templates,
    textNumber: await textSenderNumber(),
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
  const start = { channel: "email", sendBy: "gmail", sentFrom: BROADCAST_SENDER.email } as const;
  const [choices, sender, templates, parts] = await Promise.all([
    supporterChoices(),
    broadcastSender(start),
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
      topics: ["newsletter"],
      template: null,
      sendBy: start.sendBy,
      waitingSince: null,
      waitReason: null,
      gaveUp: false,
      restingUntil: null,
    },
    data: {
      filter,
      choices,
      unknown: [],
      count: 0,
      ...broadcastChoices([], parts),
      sender,
      me,
      sends: channelSends("email"),
      textsSend: channelSends("text"),
      templates,
      textNumber: await textSenderNumber(),
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
  const from = `FROM broadcast_messages c WHERE c.mailing_id = $1 AND ${tabCondition(tab)}`;
  const [[summary], recipients, [{ total }], choices, parts] = await Promise.all([
    query<BroadcastSummary>(`${SELECT_BROADCASTS} AND m.id = $1 GROUP BY m.id`, [id]),
    query<MessageRecipient>(
      `SELECT c.id::int AS "copyId", c.supporter_id::int AS "supporterId", c.merge_values ->> 'name' AS name,
         c.merge_values ->> 'place' AS place, c.status, c.skip_reason AS "skipReason", c.sent_at AS "sentAt",
         ${COPY_STATE} AS state, ${COPY_WHY} AS why
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
  const sender = written.state === "sending" ? await broadcastSender(written) : undefined;
  const listed = now?.total ?? total;
  return {
    kind: "written",
    written,
    summary: { ...summary, to: now?.total ?? summary.to },
    choices,
    parts: Object.fromEntries(parts.map((part) => [part.id, part.label])),
    tab,
    atLimit: sender?.remaining === 0,
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
  // By name, those with none last, as among the copies of one that has started (listed by SQL, nulls last).
  const rows = [...recipients]
    .sort((a, b) => Number(!a.name) - Number(!b.name) || String(a.name).localeCompare(String(b.name)))
    .slice((page - 1) * RECIPIENTS_PAGE_SIZE, page * RECIPIENTS_PAGE_SIZE)
    .map((one) => ({
      copyId: one.id,
      supporterId: one.id,
      name: one.name,
      place: one.place,
      status: "scheduled" as const,
      skipReason: null,
      sentAt: null,
      state: "scheduled" as const,
      why: null,
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
  /** What sends an email (lib/broadcasts.ts); a text goes by WhatsApp. */
  sendBy: BroadcastSendBy;
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
  /** A text's footer, as its template went to WhatsApp; none for an email, or a template whose footer we don't know. */
  footer: string | null;
  /** Where it stands, and why, as a recipient's row has them. */
  state: CopyState;
  why: string | null;
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
       m.from_name AS "fromName", m.sent_from AS "sentFrom", m.send_by AS "sendBy", c.supporter_id::int AS "supporterId",
       c.merge_values ->> 'name' AS name, c.merge_values ->> 'place' AS place, c.address,
       CASE WHEN c.merge_values ? 'values' THEN c.merge_values END AS merge, c.status, c.skip_reason AS "skipReason", c.sent_at AS "sentAt",
       ${COPY_STATE} AS state, ${COPY_WHY} AS why, c.topics,
       (SELECT t.footer FROM whatsapp_templates t WHERE t.id = m.template_id) AS footer
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
  /** Where it stands, and why, as a recipient's row has them. */
  state: CopyState;
  why: string | null;
};

/** The broadcasts a supporter was sent, newest first. */
export async function broadcastsToSupporter(supporterId: number): Promise<SupporterBroadcastRow[]> {
  return query<SupporterBroadcastRow>(
    `SELECT c.id::int AS "copyId", m.id::int AS "messageId", m.title, m.channel, c.status, c.skip_reason AS "skipReason",
       c.sent_at AS "sentAt", ${COPY_STATE} AS state, ${COPY_WHY} AS why
     FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE c.supporter_id = $1 ORDER BY c.sent_at DESC NULLS FIRST, c.id DESC`,
    [supporterId],
  );
}

/** The draft the supporters list is choosing who for. */
export type ChoosingBroadcast = Pick<WrittenBroadcast, "id" | "channel" | "topics"> & {
  title: string;
  /** Nothing written yet, as from New broadcast. */
  blank: boolean;
};

/** The Consent a draft being chosen for goes under, as the list's Consent filter writes it: a value, or one a topic. */
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
    topics: draft.topics,
    title: draft.title || staffCopy.broadcastPages.newTitle[draft.channel],
    blank: !draft.title,
  };
}
