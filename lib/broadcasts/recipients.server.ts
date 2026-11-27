import "server-only";
import type { MailingChoice } from "@/lib/mailings/fields";
import type { MailingRecipientValues } from "@/lib/mailings/doc";
import { supportersSearch, type StoredFilter } from "@/lib/staff-search";
import {
  BROADCAST_FIELDS,
  FIELD_WORDS,
  firstNameOf,
  HAS_MP,
  hasField,
  MP_FIELDS,
  MP_CONSTITUENCY,
  MP_NAME,
  mpLinkCampaign,
  registeredFor,
  wroteIn,
  type BroadcastTerms,
} from "./broadcasts";
import { MP_CHOICES } from "@/lib/supporters/mp-choices.server";
import { normalisePostcode } from "@/lib/postcodes";
import { campaignNamed } from "@/lib/content/campaigns";
import type { ContactPermission, Topic } from "@/lib/supporters/contact-permissions";
import { staffDate } from "@/lib/staff-time";
import type { SupporterRow } from "@/lib/supporters/supporters";
import { query } from "@/lib/server/db.server";
import { listSupporters, supporterChoices, supportersFoundBy } from "@/lib/supporters/records.server";
import { supportersCopy } from "@/lib/supporters/copy";
import { broadcastsCopy } from "./copy";

// Who a broadcast to supporters goes to: everyone the supporters list's filter
// finds, of whom those contact_permission() says yes for, by the broadcast's
// channel's way and topics. The list and the permissions are read when asked, so a
// stop made since the draft was opened counts.

const copy = broadcastsCopy.broadcastPages;

/** A supporter a broadcast goes to: where, and what it's filled in with. */
export type SupporterRecipient = MailingRecipientValues & {
  id: number;
  /** None for someone with no name: their email is to their address alone, and the pages say they have none. */
  name: string | null;
  /** Their email address, or number, that said yes. */
  address: string;
  place: string | null;
  /** The broadcast's topics it said yes to, which it goes under. */
  topics: Topic[];
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
 * Every part a broadcast's words can be only for: those with an MP; those who wrote to their
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
    { id: HAS_MP, label: conditions.hasMp, group: conditions.mpGroup, option: conditions.hasMpOption },
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
      option: supportersCopy.supporters.filters.eventChoice(event.name, staffDate(event.startAt)),
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

/**
 * Each of these supporters' email addresses, the one we saw most recently
 * first: where their email goes when more than one said yes.
 */
async function newestEmails(ids: number[]): Promise<Map<number, string[]>> {
  const rows = await query<{ id: number; emails: string[] }>(
    `SELECT supporter_id::int AS id, array_agg(email ORDER BY seen DESC NULLS LAST, email) AS emails
     FROM (SELECT supporter_id, lower(trim(email)) AS email, max(seen_at) AS seen FROM supporter_identity
       WHERE supporter_id = ANY($1) GROUP BY 1, 2) e
     GROUP BY supporter_id`,
    [ids],
  );
  return new Map(rows.map((row) => [row.id, row.emails]));
}

/** The postcode that places a supporter, which finds their MP; null for one placed some other way, or not at all. */
function placingPostcode(row: Pick<SupporterRow, "place">): string | null {
  return row.place?.basis === "postcode" ? row.place.given : null;
}

/**
 * The name of the MP of each of these postcodes, as the supporters' pages
 * find it: the MP in office for its constituency. By the postcode as
 * postcode_places keeps it, in capitals with no spaces.
 */
async function mpsOf(postcodes: string[]): Promise<Map<string, TheirMp>> {
  const rows = await query<{ postcode: string } & TheirMp>(
    `SELECT pp.postcode, m.name, m.constituency FROM postcode_places pp JOIN (${MP_CHOICES}) m ON m.constituency = pp.constituency
     WHERE pp.postcode = ANY(SELECT upper(replace(p, ' ', '')) FROM unnest($1::text[]) p)`,
    [postcodes],
  );
  return new Map(rows.map(({ postcode, ...mp }) => [postcode, mp]));
}

/** A supporter's MP, as their merge values say them. */
type TheirMp = { name: string; constituency: string };

/**
 * A supporter's merge values, each field's fallback for those without it, and
 * the conditions they meet: a field they have, or a part they're in. Their
 * MP's name and constituency, with `mp` the MP of the postcode that places them;
 * the links to write to them are made as each copy goes (withWriteLinks).
 */
function recipientValues(row: SupporterRow, parts: string[], mp: TheirMp | undefined): MailingRecipientValues {
  const given: Record<(typeof BROADCAST_FIELDS)[number], string | null | undefined> = {
    firstName: firstNameOf(row.name),
    name: row.name?.trim(),
  };
  return {
    values: {
      ...Object.fromEntries(BROADCAST_FIELDS.map((field) => [field, given[field] || copy.fallbacks[field]])),
      ...(mp && { [MP_NAME]: mp.name, [MP_CONSTITUENCY]: mp.constituency }),
    },
    meets: [...BROADCAST_FIELDS.filter((field) => given[field]).map(hasField), ...(mp ? [HAS_MP] : []), ...parts],
  };
}

/** Which of someone's answers say yes to a broadcast on these terms. A text goes to a number that said yes by text, never by call. */
function yesesFor(permissions: ContactPermission[], { channel, topics }: BroadcastTerms): ContactPermission[] {
  return permissions.filter((one) => one.way === channel && topics.includes(one.topic) && one.send === "yes");
}

/**
 * How many each broadcast goes to, as supporterAudience() counts them, in its
 * order: for a list of broadcasts, which would otherwise find each one's
 * recipients in turn. Two rounds of the database, however many broadcasts
 * (supportersFoundBy).
 */
export async function audienceSizes(broadcasts: { filter: StoredFilter; terms: BroadcastTerms }[]): Promise<number[]> {
  const found = await supportersFoundBy(broadcasts.map(({ filter }) => supportersSearch(filter.params).filter));
  return found.map((people, i) => people.filter((answers) => yesesFor(answers, broadcasts[i].terms).length).length);
}

/**
 * Who a broadcast with this filter, channel and topics goes to, and what its
 * words can use: those the filter finds with an address or number that said
 * yes. Its Consent filter finds only them already; this is the check as
 * sending makes it.
 */
export async function supporterAudience(filter: StoredFilter, terms: BroadcastTerms): Promise<SupporterAudience> {
  const { supporters } = await listSupporters(supportersSearch(filter.params).filter, null);
  const ids = supporters.map((row) => row.id);
  const postcodes = supporters.flatMap((row) => placingPostcode(row) ?? []);
  const [parts, inParts, emails, mps] = await Promise.all([
    broadcastParts(),
    partsOf(ids),
    newestEmails(ids),
    mpsOf(postcodes),
  ]);
  const recipients: SupporterRecipient[] = [];
  const { topics } = terms;
  for (const row of supporters) {
    const name = row.name?.trim() || null;
    const yeses = yesesFor(row.permissions, terms);
    if (!yeses.length) continue;
    // One copy each, to the newest of their addresses or numbers that said yes: the list has their numbers newest first.
    const newestFirst = terms.channel === "email" ? emails.get(row.id)! : row.phones;
    const address = newestFirst.find((one) => yeses.some((yes) => yes.address === one))!;
    const postcode = placingPostcode(row);
    const values = recipientValues(
      row,
      inParts.get(row.id) ?? [],
      postcode ? mps.get(normalisePostcode(postcode)) : undefined,
    );
    const theirs = topics.filter((topic) => yeses.some((one) => one.address === address && one.topic === topic));
    recipients.push({ id: row.id, name, address, place: row.place?.name ?? null, topics: theirs, ...values });
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
    fields: [
      ...BROADCAST_FIELDS.map((id) => ({
        id,
        label: FIELD_WORDS[id],
        lacking: recipients.length - covering(hasField(id)),
        fallback: true,
      })),
      // With no fallback, but usable all the same: scheduling stops while someone with no MP would see one.
      ...MP_FIELDS.map((id) => ({
        id,
        label: FIELD_WORDS[id],
        lacking: recipients.length - covering(HAS_MP),
        onlyInPart: true,
        // A link for each campaign is one lozenge, whose menu picks the campaign.
        ...(mpLinkCampaign(id) && { group: copy.mpFieldWords.linkGroup, option: campaignNamed(mpLinkCampaign(id)!)!.title }),
      })),
    ],
    conditions: parts.map((part) => ({ ...part, covers: covering(part.id) })),
  };
}
