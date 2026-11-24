import "server-only";
import type { MailingDoc, MailingRecipientValues } from "@/lib/mailings/doc";
import { checkMailingDoc } from "@/lib/mailings/doc";
import type { MailingChoice } from "@/lib/mailings/fields";
import { mailingGroups, type MailingGroup } from "@/lib/mailings/groups";
import { now } from "@/lib/now";
import { storedFilter, type StoredFilter } from "@/lib/staff-search";
import { firstOf, pageNumber, type ParamValue } from "@/lib/list-params";
import {
  BROADCAST_SENDER,
  DEFAULT_SEND_BY,
  RECIPIENT_SORTS,
  restsUntil,
  sendingPause,
  type BroadcastChannel,
  type BroadcastSendBy,
  type BroadcastTerms,
  type RecipientSort,
  type SendingPause,
} from "./broadcasts";
import { parseSort, type SortSpec } from "@/lib/staff-sort";
import type { Topic } from "@/lib/supporters/contact-permissions";
import { answersTo, reactionsTo, type BroadcastAnswer, type BroadcastReaction } from "./answers.server";
import { repliesTo, type BroadcastReply } from "./replies.server";
import { query } from "@/lib/server/db.server";
import { channelSends, textSenderNumber } from "./channels.server";
import {
  approvedTemplates,
  broadcastSender,
  TOPICS_OF,
  getWrittenBroadcast,
  type WhatsAppTemplate,
  type WrittenBroadcast,
} from "./drafts.server";
import { audienceSizes, broadcastChoices, broadcastParts, supporterAudience } from "./recipients.server";
import type { MailingBase } from "@/lib/mailings/records.server";
import { checkStoredFilter, filterProblems } from "@/lib/server/stored-filters.server";
import { supporterChoices, type SupporterChoices } from "@/lib/supporters/records.server";
import { broadcastsCopy } from "./copy";
import { COPY_STATE, COPY_STATES, COPY_WHY, HELD, TO_LOOK_AT, type CopyState } from "./copy-states.server";

// What the pages of broadcasts to supporters show: the list of them, a draft
// to write, one scheduled or sent with its recipients, and one copy as sent.
// To staff, broadcasts are apart from mailings, though both are rows
// of `mailings`, so this reads only those to supporters.

/** A broadcast in the list: a mailing's summary, with what only a broadcast has. */
export type BroadcastSummary = MailingBase & {
  channel: BroadcastChannel;
  /** What sends an email; Gmail says nothing of what arrives, so its copies stay sent. */
  sendBy: BroadcastSendBy;
  /** When it stops trying, in minutes after its time; none for the most (sendingStopsAt). */
  finishMinutes: number | null;
  /** A draft or one scheduled whose template WhatsApp is reviewing. */
  waiting: boolean;
  /** A draft on words WhatsApp has approved, so it can be scheduled. */
  approved: boolean;
  /** A draft whose new words WhatsApp rejected, until they're sent again or a template's chosen. */
  rejected: boolean;
  /** One that stopped by itself, and why (StopReason in sending.server.ts). */
  gaveUp: boolean;
  waitReason: string | null;
  /** How many of its copies are in each state (COPY_STATES). */
  states: Record<(typeof COPY_STATES)[number], number>;
  /** Why nothing of it is going out for now, if it's sending or past its time and nothing is (sendingPause). */
  pause: SendingPause | null;
};

/** A broadcast as SELECT_BROADCASTS reads it: its summary, with what its pause is worked out from in place of it (withPause). */
type SummaryRow = Omit<BroadcastSummary, "pause"> & {
  waitingSince: Date | null;
  waitSaid: string | null;
  tryFailedAt: Date | null;
  /** When the first of the copies WhatsApp held is next tried (HELD); null with none held. */
  heldTill: Date | null;
};

const SELECT_BROADCASTS = `
  SELECT m.id::int AS id, m.title, m.ask, NULL AS "askTitle", false AS imported, m.state, m.created_by AS "createdBy",
    coalesce(nullif(m.from_name, ''), m.sent_from) AS "fromName", m.sent_from AS "sentFrom", m.due_at AS "dueAt",
    m.updated_at AS "updatedAt", m.channel, m.send_by AS "sendBy", m.finish_minutes AS "finishMinutes",
    EXISTS (SELECT 1 FROM whatsapp_templates t WHERE t.id = m.template_id AND t.status = 'pending') AS waiting,
    EXISTS (SELECT 1 FROM whatsapp_templates t WHERE t.id = m.template_id AND t.status = 'approved') AS approved,
    EXISTS (SELECT 1 FROM whatsapp_templates t WHERE t.id = m.template_id AND t.status = 'rejected') AS rejected,
    m.gave_up AS "gaveUp", m.wait_reason AS "waitReason", m.waiting_since AS "waitingSince", coalesce(m.wait_failure->>'said', m.wait_said) AS "waitSaid",
    m.try_failed_at AS "tryFailedAt", min(c.not_before) FILTER (WHERE ${HELD}) AS "heldTill",
    min(c.sent_at) AS "sentAt",
    count(c.id)::int AS "to",
    -- As the sending bar counts them (MailingsOverview): those that went, not one still delayed, and those done with
    -- but not sent, which takes in one delayed till its days ran out.
    count(c.id) FILTER (WHERE c.status IN ('sent', 'delivered') AND s.state NOT IN ('error', 'held'))::int AS sent,
    count(c.id) FILTER (WHERE c.status IN ('failed', 'skipped', 'cancelled') OR s.state = 'error')::int AS failed,
    0 AS answered,
    -- How many are in each state.
    json_build_object(${COPY_STATES.map((one) => `'${one}', count(c.id) FILTER (WHERE s.state = '${one}')`).join(", ")}) AS states
  FROM mailings m LEFT JOIN broadcast_messages c ON c.mailing_id = m.id
  LEFT JOIN LATERAL (SELECT ${COPY_STATE} AS state) s ON true
  WHERE m.audience = 'supporters'`;

/**
 * A broadcast's summary with its pause (sendingPause), from its row: it
 * rests for REST_MINUTES after a failed try, and only one sending, with
 * nothing else pausing it, asks what sends it whether it can send more today.
 * One sent with emails still delayed is said to be sending, paused for them,
 * in the list and on its page, though its state stays sent: it can't stick,
 * as its delayed copies become errors once its days run out.
 */
async function withPause(row: SummaryRow): Promise<BroadcastSummary> {
  const { waitingSince, waitSaid, tryFailedAt, heldTill, ...summary } = row;
  const restsTill = tryFailedAt && restsUntil(tryFailedAt);
  const facts = {
    ...summary,
    waitingSince,
    waitSaid,
    restingUntil: restsTill && restsTill > now() ? restsTill : null,
    toGo: summary.states["to-go"],
    // Only a text is held by WhatsApp, and only an email delayed by Postmark, so all a text's held are WhatsApp's.
    held: summary.states.held,
    heldTill,
  };
  const pause = sendingPause({ ...facts, atLimit: false });
  if (pause?.kind === "delayed") return { ...summary, state: "sending", pause };
  if (pause || summary.state !== "sending") return { ...summary, pause };
  const atLimit = (await broadcastSender(summary)).remaining === 0;
  return { ...summary, pause: sendingPause({ ...facts, atLimit }) };
}

/**
 * The page of broadcasts, in its groups (mailingGroups): those scheduled;
 * those sending, or waiting; the drafts; and those done with;
 * and now, which says which year needn't be written.
 */
export async function broadcastsPage(): Promise<{ groups: MailingGroup<BroadcastSummary>[]; now: string }> {
  // A draft or one scheduled has no messages yet, so how many it goes to is who its filters find now.
  const [unsent, rows] = await Promise.all([
    query<SummaryRow & { filter: unknown; topics: BroadcastTerms["topics"] }>(
      `SELECT d.*, f.filter, f.topics
       FROM (${SELECT_BROADCASTS} AND m.state IN ('draft', 'scheduled') GROUP BY m.id) d
       JOIN (SELECT id::int AS id, filter, ${TOPICS_OF} AS topics FROM mailings) f USING (id)
       ORDER BY d."updatedAt" DESC, d.id DESC`,
    ),
    query<SummaryRow>(
      `${SELECT_BROADCASTS} AND m.state NOT IN ('draft', 'scheduled') GROUP BY m.id
       ORDER BY min(c.sent_at) DESC NULLS FIRST, m.id DESC`,
    ),
  ]);
  const drafts = unsent.map(({ filter, topics, ...broadcast }) => ({
    broadcast,
    audience: { filter: checkStoredFilter(filter)!, terms: { channel: broadcast.channel, topics } },
  }));
  const [sizes, paused, all] = await Promise.all([
    audienceSizes(drafts.map(({ audience }) => audience)),
    Promise.all(drafts.map(({ broadcast }) => withPause(broadcast))),
    Promise.all(rows.map(withPause)),
  ]);
  const counted = paused.map((broadcast, i) => ({ ...broadcast, to: sizes[i] }));
  const at = now();
  return {
    groups: mailingGroups(
      {
        scheduled: counted
          .filter((m) => m.state === "scheduled")
          .sort((a, b) => a.dueAt!.getTime() - b.dueAt!.getTime()),
        // Going out, then waiting, however long ago it started, as it isn't done.
        sending: [...all.filter((m) => m.state === "sending" && !m.pause), ...all.filter((m) => m.pause)],
        drafts: counted.filter((m) => m.state === "draft"),
        done: all.filter((m) => m.state !== "sending"),
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
  /** When it last changed: the newest thing in its history, or when it was sent; null for one that hasn't gone. */
  changedAt: Date | null;
  /** When one WhatsApp held is next tried (HELD); null for the rest. */
  heldTill: Date | null;
  /** Where it stands (COPY_STATE), and why, where that state has one (COPY_WHY). */
  state: CopyState;
  why: string | null;
};

// When a copy last changed: the newest thing its history holds (sent, delivered, read, replied, a bounce, an
// opt-out), or for one with no history, when it was sent.
const CHANGED_AT = "coalesce((SELECT max(e.at) FROM broadcast_message_events e WHERE e.message_id = c.id), c.sent_at)";

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
      /** What its recipients are sorted by (RECIPIENT_SORTS). */
      sort: SortSpec<RecipientSort>;
      recipients: MessageRecipient[];
      recipientsTotal: number;
      page: number;
      pages: number;
      pageSize: number;
    };

/** What a draft's writer shows, each part asked for at once, as changing its Consent waits for it all. */
async function writerData(draft: WrittenBroadcast, me: string): Promise<BroadcastWriterData> {
  const [audience, unknown, choices, sender, templates, textNumber] = await Promise.all([
    supporterAudience(draft.filter, draft),
    filterProblems(draft.filter),
    supporterChoices(),
    broadcastSender(draft),
    approvedTemplates(),
    textSenderNumber(),
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
    textNumber,
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
  const start = { channel: "email", sendBy: DEFAULT_SEND_BY, sentFrom: BROADCAST_SENDER.email } as const;
  const [choices, sender, templates, parts, textNumber] = await Promise.all([
    supporterChoices(),
    broadcastSender(start),
    approvedTemplates(),
    broadcastParts(),
    textSenderNumber(),
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
      finishMinutes: null,
      waitingSince: null,
      waitReason: null,
      waitSaid: null,
      gaveUp: false,
      header: null,
      place: null,
      buttons: [],
      textVersion: null,
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
      textNumber,
    },
  };
}

/**
 * A broadcast's page: a draft, to write, which opening keeps from being tidied
 * away; or one scheduled or sent, with a page of its recipients in a tab,
 * sorted as its URL asks (RECIPIENT_SORTS), one scheduled's always by name;
 * as `me`, the staff member looking. Undefined for none.
 */
export async function broadcastPageData(
  id: number,
  search: { page?: ParamValue; tab?: ParamValue; sort?: ParamValue; dir?: ParamValue },
  me: string,
): Promise<BroadcastPageData | undefined> {
  const written = await getWrittenBroadcast(id, true);
  if (!written) return undefined;
  if (written.state === "draft") return { kind: "draft", draft: written, ...(await writerData(written, me)) };
  const tab = MESSAGE_TABS.find((one) => one === firstOf(search.tab)) ?? "all";
  const page = pageNumber(firstOf(search.page));
  const sort = parseSort(RECIPIENT_SORTS, "who", firstOf(search.sort), firstOf(search.dir));
  const from = `FROM broadcast_messages c WHERE c.mailing_id = $1 AND ${tabCondition(tab)}`;
  // By name, replies to check first; or by when each last changed, those that haven't gone last either way.
  const order =
    sort.key === "who"
      ? `${TO_LOOK_AT} DESC, (c.merge_values ->> 'name') COLLATE english ${sort.dir} NULLS LAST`
      : `${CHANGED_AT} ${sort.dir} NULLS LAST`;
  const [summary, recipients, [{ total }], choices, parts] = await Promise.all([
    query<SummaryRow>(`${SELECT_BROADCASTS} AND m.id = $1 GROUP BY m.id`, [id]).then(([row]) => withPause(row)),
    query<MessageRecipient>(
      `SELECT c.id::int AS "copyId", c.supporter_id::int AS "supporterId", c.merge_values ->> 'name' AS name,
         c.merge_values ->> 'place' AS place, c.status, c.skip_reason AS "skipReason", c.sent_at AS "sentAt",
         ${CHANGED_AT} AS "changedAt", CASE WHEN ${HELD} THEN c.not_before END AS "heldTill",
         ${COPY_STATE} AS state, ${COPY_WHY} AS why
       ${from} ORDER BY ${order}, c.id
       LIMIT $2 OFFSET $3`,
      [id, RECIPIENTS_PAGE_SIZE, (page - 1) * RECIPIENTS_PAGE_SIZE],
    ),
    query<{ total: number }>(`SELECT count(*)::int AS total ${from}`, [id]),
    supporterChoices(),
    broadcastParts(),
  ]);
  // One scheduled has no messages yet: it goes to whoever its filters find when it's sent, so for now, who they
  // find, a page at a time, each yet to be sent.
  const found = written.state === "scheduled" ? await scheduledRecipients(written, page) : undefined;
  const listed = found?.total ?? total;
  return {
    kind: "written",
    written,
    summary: { ...summary, to: found?.total ?? summary.to },
    choices,
    parts: Object.fromEntries(parts.map((part) => [part.id, part.label])),
    tab,
    sort,
    recipients: found?.rows ?? recipients,
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
      changedAt: null,
      heldTill: null,
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
  return broadcast && (broadcast.title || broadcastsCopy.broadcastPages.untitled);
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
  return broadcast && (broadcast.draft ? broadcastsCopy.broadcastPages.draftCrumb : broadcast.title);
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
  /** What sends an email (lib/broadcasts/broadcasts.ts); a text goes by WhatsApp. */
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
  /** What sent it calls it (WhatsApp's or Postmark's message ID, or Gmail's); none till it went. */
  providerId: string | null;
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
  /** The emoji staff put on those replies to a text, oldest first. */
  reactions: BroadcastReaction[];
};

/** Something that happened to a copy, as its provider reported it. */
export type BroadcastEvent = { at: Date; kind: string; details: Record<string, unknown> };

/** One copy of a broadcast, by its broadcast's ID and its own; or undefined. */
export async function messageCopy(broadcastId: number, copyId: number): Promise<MessageCopy | undefined> {
  const [row] = await query<Omit<MessageCopy, "events" | "replies" | "answers" | "reactions">>(
    `SELECT c.id::int AS id, m.id::int AS "messageId", m.title, m.channel, m.subject, m.body,
       m.from_name AS "fromName", m.sent_from AS "sentFrom", m.send_by AS "sendBy", c.supporter_id::int AS "supporterId",
       c.merge_values ->> 'name' AS name, c.merge_values ->> 'place' AS place, c.address,
       CASE WHEN c.merge_values ? 'values' THEN c.merge_values END AS merge, c.status, c.skip_reason AS "skipReason", c.sent_at AS "sentAt",
       c.provider_message_id AS "providerId",
       ${COPY_STATE} AS state, ${COPY_WHY} AS why, c.topics,
       (SELECT t.footer FROM whatsapp_templates t WHERE t.id = m.template_id) AS footer
     FROM broadcast_messages c JOIN mailings m ON m.id = c.mailing_id
     WHERE c.id = $2 AND m.id = $1 AND m.audience = 'supporters'`,
    [broadcastId, copyId],
  );
  if (!row) return undefined;
  const [events, replies, answers, reactions] = await Promise.all([
    query<BroadcastEvent>(
      "SELECT at, kind, details FROM broadcast_message_events WHERE message_id = $1 ORDER BY at DESC, id DESC",
      [copyId],
    ),
    repliesTo(copyId),
    answersTo(copyId),
    reactionsTo(copyId),
  ]);
  return { ...row, body: checkMailingDoc(row.body)!, events, replies, answers, reactions };
}
