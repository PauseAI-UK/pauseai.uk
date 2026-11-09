import "server-only";
import type { ContactPermission } from "@/lib/contact-permissions";
import { staffCopy } from "@/lib/content/staff-interface";
import type { MailingChoice } from "@/lib/mailing-fields";
import type { MailingRecipientValues } from "@/lib/mailing-doc";
import { supportersSearch, type StoredFilter } from "@/lib/staff-search";
import {
  firstNameOf,
  hasField,
  MEMBER_CONDITION,
  BROADCAST_FIELDS,
  VOLUNTEER_CONDITION,
  type BroadcastTerms,
} from "@/lib/broadcasts";
import type { SupporterRow } from "@/lib/supporters";
import { query } from "./db";
import { listSupporters, MP_CHOICES } from "./supporters";

// Who a broadcast to supporters goes to: everyone the supporters list's filter
// finds, of whom those contact_permission() says yes for, by the broadcast's
// channel and topic. The list and the permissions are read when asked, so a
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

/** Someone the filter finds whom a broadcast can't go to, and why: no yes for this topic, a stop, or a blocked address. */
export type BroadcastLeftOutReason = "no-permission" | "stopped" | "blocked";
export type BroadcastLeftOut = { id: number; name: string; reason: BroadcastLeftOutReason };

export type SupporterAudience = {
  recipients: SupporterRecipient[];
  leftOut: BroadcastLeftOut[];
  /** The merge fields, with how many recipients lack a value for each and get its fallback. */
  fields: MailingChoice[];
  /** What a part can be only for, with how many recipients each covers. */
  conditions: MailingChoice[];
};

/** Each postcode's MP, in office for its constituency, by the postcode as postcode_places has it. */
async function mpsByPostcode(postcodes: string[]): Promise<Map<string, string>> {
  const rows = await query<{ postcode: string; name: string }>(
    `SELECT pp.postcode, m.name FROM postcode_places pp JOIN (${MP_CHOICES}) m ON m.constituency = pp.constituency
     WHERE pp.postcode = ANY($1::text[])`,
    [postcodes.map(postcodeKey)],
  );
  return new Map(rows.map((row) => [row.postcode, row.name]));
}

const postcodeKey = (postcode: string) => postcode.replace(/ /g, "").toUpperCase();

/** Why none of someone's addresses can be used: a stop or a block outranks never having said yes. */
function whyLeftOut(answers: ContactPermission[]): BroadcastLeftOutReason {
  if (answers.some((answer) => answer.reason === "blocked")) return "blocked";
  const stops = ["unsubscribed", "removed", "ended"];
  return answers.some((answer) => stops.includes(answer.reason)) ? "stopped" : "no-permission";
}

/** A supporter's merge values, each field's fallback for those without it, and the conditions they meet. */
function recipientValues(row: SupporterRow, mp: string | undefined): MailingRecipientValues {
  const given: Record<(typeof BROADCAST_FIELDS)[number], string | null | undefined> = {
    firstName: firstNameOf(row.name),
    name: row.name?.trim(),
    mp,
  };
  const volunteers = row.permissions.some((answer) => answer.reason === "volunteered");
  return {
    values: Object.fromEntries(BROADCAST_FIELDS.map((field) => [field, given[field] || copy.fallbacks[field]])),
    meets: [
      ...BROADCAST_FIELDS.filter((field) => given[field]).map(hasField),
      ...(volunteers ? [VOLUNTEER_CONDITION] : []),
      ...(row.member ? [MEMBER_CONDITION] : []),
    ],
  };
}

/** Who a broadcast with this filter, channel and topic goes to and who it leaves out, and what its words can use. */
export async function supporterAudience(filter: StoredFilter, terms: BroadcastTerms): Promise<SupporterAudience> {
  const { supporters } = await listSupporters(supportersSearch(filter.params).filter, null);
  const mps = await mpsByPostcode(supporters.flatMap((row) => row.postcode ?? []));
  const channel = terms.channel === "email" ? "email" : "phone";
  const recipients: SupporterRecipient[] = [];
  const leftOut: BroadcastLeftOut[] = [];
  for (const row of supporters) {
    const name = row.name || staffCopy.supporters.noName;
    const answers = row.permissions.filter((one) => one.channel === channel && one.topic === terms.topic);
    const yes = answers.find((answer) => answer.send === "yes");
    if (!yes) {
      leftOut.push({ id: row.id, name, reason: whyLeftOut(answers) });
      continue;
    }
    const values = recipientValues(row, row.postcode ? mps.get(postcodeKey(row.postcode)) : undefined);
    recipients.push({ id: row.id, name, address: yes.address, place: row.place?.name ?? null, ...values });
  }
  return { recipients, leftOut, ...broadcastChoices(recipients) };
}

/**
 * What a broadcast's words can use, for these `recipients`: each merge field,
 * with how many lack it and get its fallback, and each condition a part can
 * be only for, with how many it covers.
 */
export function broadcastChoices(
  recipients: Pick<SupporterRecipient, "meets">[],
): Pick<SupporterAudience, "fields" | "conditions"> {
  const covering = (id: string) => recipients.filter((recipient) => recipient.meets.includes(id)).length;
  const conditionCopy = copy.conditions;
  return {
    fields: BROADCAST_FIELDS.map((id) => ({
      id,
      label: copy.fieldWords[id],
      lacking: recipients.length - covering(hasField(id)),
      fallback: true,
    })),
    conditions: [
      { id: hasField("mp"), ...conditionCopy.mp },
      { id: VOLUNTEER_CONDITION, ...conditionCopy.volunteer },
      { id: MEMBER_CONDITION, ...conditionCopy.member },
    ].map((condition) => ({ ...condition, covers: covering(condition.id) })),
  };
}
