import "server-only";
import type { MailingDoc, MailingRecipientValues } from "@/lib/mailing-doc";
import { checkMailingDoc } from "@/lib/mailing-doc";
import type { MailingChoice } from "@/lib/mailing-fields";
import { mailingGroups, type MailingGroup } from "@/lib/mailing-groups";
import { stateValue } from "@/lib/contact-permissions";
import { now } from "@/lib/now";
import { firstOf, pageNumber, storedFilter, type Params, type ParamValue, type StoredFilter } from "@/lib/staff-search";
import { BROADCAST_SENDER, type BroadcastChannel, type BroadcastTerms } from "@/lib/broadcasts";
import { staffCopy } from "@/lib/content/staff-interface";
import { query } from "./db";
import { gmailAccounts, type GmailAccount } from "./gmail-accounts";
import { isLettersInboxAddress } from "./letters-inbox";
import { broadcastBackend, textSenderNumber } from "./broadcast-channels";
import {
  approvedTemplates,
  getWrittenBroadcast,
  type WhatsAppTemplate,
  type WrittenBroadcast,
} from "./broadcast-drafts";
import { broadcastChoices, supporterAudience, type BroadcastLeftOut } from "./broadcast-recipients";
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
};

const STOPPED = "(c.status = 'cancelled' OR c.skip_reason = 'unsubscribed')";
const FAILED = "(c.status = 'failed' OR (c.status = 'skipped' AND c.skip_reason <> 'unsubscribed'))";
const WAS_READ = "EXISTS (SELECT 1 FROM broadcast_message_events e WHERE e.message_id = c.id AND e.kind = 'read')";

const SELECT_BROADCASTS = `
  SELECT m.id::int AS id, m.title, m.ask, NULL AS "askTitle", false AS imported, m.state, m.created_by AS "createdBy",
    coalesce(nullif(m.from_name, ''), m.sent_from) AS "fromName", m.sent_from AS "sentFrom", m.due_at AS "dueAt",
    m.updated_at AS "updatedAt", m.channel,
    EXISTS (SELECT 1 FROM whatsapp_templates t WHERE t.id = m.template_id AND t.status = 'pending') AS waiting,
    min(c.sent_at) AS "sentAt",
    count(c.id)::int AS "to",
    count(c.id) FILTER (WHERE c.status IN ('sent', 'delivered'))::int AS sent,
    count(c.id) FILTER (WHERE c.status = 'delivered')::int AS delivered,
    count(c.id) FILTER (WHERE ${FAILED})::int AS failed,
    count(c.id) FILTER (WHERE ${STOPPED})::int AS stopped,
    count(c.id) FILTER (WHERE ${WAS_READ})::int AS read,
    0 AS replied,
    0 AS answered
  FROM mailings m LEFT JOIN broadcast_messages c ON c.mailing_id = m.id
  WHERE m.audience = 'supporters'`;

/** The page of broadcasts: what's coming up, and those sent under their months and years; and now, which says which year needn't be written. */
export async function broadcastsPage(): Promise<{ groups: MailingGroup<BroadcastSummary>[]; now: string }> {
  // A draft or one scheduled has no messages yet, so how many it goes to is who its filters find now.
  const [unsent, all] = await Promise.all([
    query<BroadcastSummary & { filter: unknown; topic: BroadcastTerms["topic"] }>(
      `SELECT d.*, f.filter, f.topic FROM (${SELECT_BROADCASTS} AND m.state IN ('draft', 'scheduled') GROUP BY m.id) d
       JOIN (SELECT id::int AS id, filter, topic FROM mailings) f USING (id) ORDER BY d."updatedAt" DESC, d.id DESC`,
    ),
    query<BroadcastSummary>(
      `${SELECT_BROADCASTS} AND m.state NOT IN ('draft', 'scheduled') GROUP BY m.id
       ORDER BY min(c.sent_at) DESC NULLS FIRST, m.id DESC`,
    ),
  ]);
  const counted = await Promise.all(
    unsent.map(async ({ filter, topic, ...broadcast }) => ({
      ...broadcast,
      to: (await supporterAudience(checkStoredFilter(filter)!, { channel: broadcast.channel, topic })).recipients
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
  read: boolean;
};

/** Which of a broadcast's recipients its page lists. */
export const MESSAGE_TABS = ["all", "delivered", "failed", "stopped", "read"] as const;
export type MessageTab = (typeof MESSAGE_TABS)[number];

const TAB_CONDITIONS: Record<MessageTab, string> = {
  all: "true",
  delivered: "c.status = 'delivered'",
  failed: FAILED,
  stopped: STOPPED,
  read: WAS_READ,
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
  leftOut: BroadcastLeftOut[];
  fields: MailingChoice[];
  conditions: MailingChoice[];
  /** The connected Gmail accounts an email can be from instead. */
  senders: GmailAccount[];
  me: string;
  /** Whether a broadcast can be sent yet. */
  sends: boolean;
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
    leftOut: audience.leftOut,
    fields: audience.fields,
    conditions: audience.conditions,
    // Never the letters inbox, which sends supporters' letters and nothing else.
    senders: senders.filter((sender) => !isLettersInboxAddress(sender.email)),
    me,
    sends: Boolean(broadcastBackend()),
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
  const [choices, senders, templates] = await Promise.all([supporterChoices(), gmailAccounts(), approvedTemplates()]);
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
      topic: "site-forms",
      template: null,
    },
    data: {
      filter,
      choices,
      unknown: [],
      count: 0,
      leftOut: [],
      ...broadcastChoices([]),
      senders: senders.filter((sender) => !isLettersInboxAddress(sender.email)),
      me,
      sends: Boolean(broadcastBackend()),
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
  const [[summary], recipients, [{ total }], choices] = await Promise.all([
    query<BroadcastSummary>(`${SELECT_BROADCASTS} AND m.id = $1 GROUP BY m.id`, [id]),
    query<MessageRecipient>(
      `SELECT c.id::int AS "copyId", c.supporter_id::int AS "supporterId", c.merge_values ->> 'name' AS name,
         c.merge_values ->> 'place' AS place, c.status, c.skip_reason AS "skipReason", c.sent_at AS "sentAt",
         ${WAS_READ} AS read
       ${from} ORDER BY c.merge_values ->> 'name' NULLS LAST, c.id LIMIT $2 OFFSET $3`,
      [id, RECIPIENTS_PAGE_SIZE, (page - 1) * RECIPIENTS_PAGE_SIZE],
    ),
    query<{ total: number }>(`SELECT count(*)::int AS total ${from}`, [id]),
    supporterChoices(),
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
};

/** Something that happened to a copy, as its provider reported it. */
export type BroadcastEvent = { at: Date; kind: string; details: Record<string, unknown> };

/** One copy of a broadcast, by its broadcast's ID and its own; or undefined. */
export async function messageCopy(broadcastId: number, copyId: number): Promise<MessageCopy | undefined> {
  const [row] = await query<Omit<MessageCopy, "events">>(
    `SELECT c.id::int AS id, m.id::int AS "messageId", m.title, m.channel, m.subject, m.body,
       m.from_name AS "fromName", m.sent_from AS "sentFrom", c.supporter_id::int AS "supporterId",
       c.merge_values ->> 'name' AS name, c.merge_values ->> 'place' AS place, c.address,
       CASE WHEN c.merge_values ? 'values' THEN c.merge_values END AS merge, c.status, c.skip_reason AS "skipReason", c.sent_at AS "sentAt"
     FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE c.id = $2 AND m.id = $1 AND m.audience = 'supporters'`,
    [broadcastId, copyId],
  );
  if (!row) return undefined;
  const events = await query<BroadcastEvent>(
    "SELECT at, kind, details FROM broadcast_message_events WHERE message_id = $1 ORDER BY at DESC, id DESC",
    [copyId],
  );
  return { ...row, body: checkMailingDoc(row.body)!, events };
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
};

/** The broadcasts a supporter was sent, newest first. */
export async function broadcastsToSupporter(supporterId: number): Promise<SupporterBroadcastRow[]> {
  return query<SupporterBroadcastRow>(
    `SELECT c.id::int AS "copyId", m.id::int AS "messageId", m.title, m.channel, c.status, c.skip_reason AS "skipReason",
       c.sent_at AS "sentAt", ${WAS_READ} AS read
     FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE c.supporter_id = $1 ORDER BY c.sent_at DESC NULLS FIRST, c.id DESC`,
    [supporterId],
  );
}

/** The draft the supporters list is choosing who for. */
export type ChoosingBroadcast = Pick<WrittenBroadcast, "id" | "channel" | "topic"> & {
  title: string;
  /** Nothing written yet, as from New broadcast. */
  blank: boolean;
};

/** The Consent a draft being chosen for goes under, as the list's Consent filter writes it. */
export function choosingConsent(choosing: ChoosingBroadcast): string {
  return stateValue({ channel: choosing.channel === "email" ? "email" : "phone", topic: choosing.topic, send: "yes" });
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
    title: draft.title || staffCopy.broadcastPages.newTitle[draft.channel],
    blank: !draft.title,
  };
}
