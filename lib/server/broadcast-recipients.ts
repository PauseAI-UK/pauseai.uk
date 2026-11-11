import "server-only";
import { staffCopy } from "@/lib/content/staff-interface";
import type { MailingChoice } from "@/lib/mailing-fields";
import type { MailingRecipientValues } from "@/lib/mailing-doc";
import { supportersSearch, type StoredFilter } from "@/lib/staff-search";
import { firstNameOf, hasField, BROADCAST_FIELDS, registeredFor, wroteIn, type BroadcastTerms } from "@/lib/broadcasts";
import { staffDate } from "@/lib/staff-time";
import type { SupporterRow } from "@/lib/supporters";
import { query } from "./db";
import { listSupporters, supporterChoices } from "./supporters";

// Who a broadcast to supporters goes to: everyone the supporters list's filter
// finds, of whom those contact_permission() says yes for, by the broadcast's
// channel's way and topic. The list and the permissions are read when asked, so a
// stop made since the draft was opened counts.

const copy = staffCopy.broadcastPages;

/** A supporter a broadcast goes to: where, and what it's filled in with. */
export type SupporterRecipient = MailingRecipientValues & {
  id: number;
  name: string;
  /** Their email address, or number, that said yes. */
  address: string;
  place: string | null;
};

export type SupporterAudience = {
  recipients: SupporterRecipient[];
  /** The merge fields, with how many recipients lack a value for each and get its fallback. */
  fields: MailingChoice[];
  /** What a part can be only for, with how many recipients each covers. */
  conditions: MailingChoice[];
};

/** A part a broadcast's words can be only for: its condition, as its box says it, and as the editor's menu offers it. */
export type BroadcastPart = Required<Pick<MailingChoice, "id" | "label" | "group" | "option">> &
  Pick<MailingChoice, "searchable">;

/**
 * Every part a broadcast's words can be only for: those who wrote to their
 * MP in each campaign, by title; and those who registered for each of our
 * events, newest first, as the Event filter offers them.
 */
export async function broadcastParts(): Promise<BroadcastPart[]> {
  const conditions = copy.conditions;
  const [campaigns, { events }] = await Promise.all([
    query<{ slug: string; title: string }>("SELECT slug, title FROM campaigns ORDER BY title, slug"),
    supporterChoices(),
  ]);
  return [
    ...campaigns.map((campaign) => ({
      id: wroteIn(campaign.slug),
      label: conditions.wrote(campaign.title),
      group: conditions.wroteGroup,
      option: campaign.title,
    })),
    ...events.map((event) => ({
      id: registeredFor(event.id),
      label: conditions.registered(event.name),
      group: conditions.registeredGroup,
      option: staffCopy.supporters.filters.eventChoice(event.name, staffDate(event.startAt)),
      searchable: true,
    })),
  ];
}

/** The parts each of these supporters is in: the campaigns they wrote to their MP in, and the events they registered for. */
async function partsOf(ids: number[]): Promise<Map<number, string[]>> {
  const rows = await query<{ id: number; campaign: string | null; event: string | null }>(
    `SELECT k.supporter_id::int AS id, l.campaign, NULL AS event
       FROM supporter_links k JOIN letters_from_supporters l ON l.entry_id = k.form_entry_id WHERE k.supporter_id = ANY($1)
     UNION SELECT k.supporter_id::int, NULL, g.event_id
       FROM supporter_links k JOIN luma_guests g ON g.user_id = k.luma_user_id
       WHERE k.supporter_id = ANY($1) AND g.approval_status <> 'declined'`,
    [ids],
  );
  const parts = new Map<number, string[]>();
  for (const row of rows) {
    parts.set(row.id, [...(parts.get(row.id) ?? []), row.campaign ? wroteIn(row.campaign) : registeredFor(row.event!)]);
  }
  return parts;
}

/** A supporter's merge values, each field's fallback for those without it, and the conditions they meet: a field they have, or a part they're in. */
function recipientValues(row: SupporterRow, parts: string[]): MailingRecipientValues {
  const given: Record<(typeof BROADCAST_FIELDS)[number], string | null | undefined> = {
    firstName: firstNameOf(row.name),
    name: row.name?.trim(),
  };
  return {
    values: Object.fromEntries(BROADCAST_FIELDS.map((field) => [field, given[field] || copy.fallbacks[field]])),
    meets: [...BROADCAST_FIELDS.filter((field) => given[field]).map(hasField), ...parts],
  };
}

/**
 * Who a broadcast with this filter, channel and topic goes to, and what its
 * words can use: those the filter finds with an address or number that said
 * yes. Its Consent filter finds only them already; this is the check as
 * sending makes it.
 */
export async function supporterAudience(filter: StoredFilter, terms: BroadcastTerms): Promise<SupporterAudience> {
  const { supporters } = await listSupporters(supportersSearch(filter.params).filter, null);
  const [parts, inParts] = await Promise.all([broadcastParts(), partsOf(supporters.map((row) => row.id))]);
  const recipients: SupporterRecipient[] = [];
  for (const row of supporters) {
    const name = row.name || staffCopy.supporters.noName;
    // A text goes to a number that said yes by text, never by call.
    const yes = row.permissions.find(
      (one) => one.way === terms.channel && one.topic === terms.topic && one.send === "yes",
    );
    if (!yes) continue;
    const values = recipientValues(row, inParts.get(row.id) ?? []);
    recipients.push({ id: row.id, name, address: yes.address, place: row.place?.name ?? null, ...values });
  }
  return { recipients, ...broadcastChoices(recipients, parts) };
}

/**
 * What a broadcast's words can use, for these `recipients`: each merge field,
 * with how many lack it and get its fallback, and each of `parts`, with how
 * many it covers.
 */
export function broadcastChoices(
  recipients: Pick<SupporterRecipient, "meets">[],
  parts: BroadcastPart[],
): Pick<SupporterAudience, "fields" | "conditions"> {
  const covering = (id: string) => recipients.filter((recipient) => recipient.meets.includes(id)).length;
  return {
    fields: BROADCAST_FIELDS.map((id) => ({
      id,
      label: copy.fieldWords[id],
      lacking: recipients.length - covering(hasField(id)),
      fallback: true,
    })),
    conditions: parts.map((part) => ({ ...part, covers: covering(part.id) })),
  };
}
