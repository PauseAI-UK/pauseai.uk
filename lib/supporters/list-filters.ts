// The supporters list's filter bar (lib/staff-list-filters.ts).
import type { ReactNode } from "react";
import { WAYS, listsBy, listValue, type List, type Way } from "./contact-permissions";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { CAMPAIGN_NAMES } from "@/lib/content/campaigns";
import type { SupporterChoices, SupportersPage } from "./records.server";
import { WINDOW_OPTIONS } from "@/lib/time-windows";
import { SUPPORTERS_LIST } from "@/lib/staff-lists";
import { staffDate } from "@/lib/staff-time";
import { ANY_MP, NEAR_MILES, SUPPORTER_BADGES } from "./supporters";
import { supportersCopy } from "./copy";
import { politiciansCopy } from "@/lib/politicians/copy";
import { listFilters, choicesOf } from "@/lib/staff-list-filters";

/**
 * The Consent filter's choices, in its order: by email, then text, then
 * call, each the lists that go by it in LISTS's order, so the same one sits
 * on the same row under each heading.
 */
export const LIST_ORDER: { list: List; way: Way }[] = WAYS.flatMap((way) =>
  listsBy(way).map((list) => ({ list, way })),
);

/** The words in the Near chip: where it found, or that it couldn't; as typed, when it wasn't looked up. */
function nearWords(text: string, found: SupportersPage["near"]): string {
  const copy = supportersCopy.supporters.filters;
  if (found === undefined) return text;
  if (found === "failed") return copy.failed(text);
  return found ? found.place : copy.notFound(text);
}

/**
 * What the supporters list's bar offers: the events and MPs there are; the
 * Near filter as typed, and what it found, once looked up; and each
 * channel's icon, for the Subscriptions filter's headings.
 */
export type SupporterBarChoices = SupporterChoices & {
  near: string;
  found?: SupportersPage["near"];
  channelIcon?: (way: Way) => ReactNode;
  /** What a Consent filter's list means, after it in a menu. */
  listHelp?: (list: List) => ReactNode;
};

/**
 * The supporters list's filters. Consent, the contact filter, is first, as
 * it's who a message can go to, and has its own button. Its choices are
 * each list by each way, as those on it, a chip for each way; one by email
 * or phone shows that column. Then those named after a column, in the
 * columns' order: their activities; the events they registered for;
 * whether they wrote in a campaign; and when they were first seen, last
 * registered for an event or unsubscribed, the lists the dashboard's tiles
 * open, the last two only from those tiles. Last, where they are, which
 * the Place column shows but none is named after: how near somewhere,
 * their MP and their nation. Activities, consents, nations,
 * MPs and events can each be chosen more than once; a supporter has one
 * nation and one MP.
 */
export const SUPPORTER_FILTERS = listFilters(
  SUPPORTERS_LIST,
  ({ events, mps, near, found, channelIcon, listHelp }: SupporterBarChoices) => {
    const copy = supportersCopy.supporters.filters;
    const { columns } = supportersCopy.supporters;
    return {
      contact: {
        label: columns.subscriptions,
        // Who a message can go to, so its own button. Each list includes those it should, so one at a time.
        own: true,
        oneAtATime: true,
        // Each list under its way's heading, as those on it by that way.
        options: LIST_ORDER.map(({ list, way }) => ({
          value: listValue(list, way),
          label: copy.lists[list],
          help: listHelp?.(list),
          group: { label: copy.ways[way], icon: channelIcon?.(way), chip: copy.wayChips[way] },
        })),
      },
      activity: {
        label: columns.badges,
        options: SUPPORTER_BADGES.map((badge) => ({ value: badge, label: supportersCopy.supporters.badges[badge] })),
      },
      event: {
        label: copy.event,
        searchable: true,
        options: events.map((event) => ({
          value: event.id,
          label: copy.eventChoice(event.name, staffDate(event.startAt)),
        })),
      },
      campaign: {
        label: copy.campaign,
        options: CAMPAIGN_NAMES.map((campaign) => ({ value: campaign.slug, label: campaign.title })),
      },
      wrote: { label: copy.campaign, after: "campaign", options: choicesOf(copy.wrote) },
      first: { label: copy.first, options: WINDOW_OPTIONS },
      registered: { label: copy.registered, options: WINDOW_OPTIONS, linkedOnly: true },
      unsubscribed: { label: copy.unsubscribed, options: WINDOW_OPTIONS, linkedOnly: true },
      near: {
        label: copy.near,
        options: near ? [{ value: near, label: nearWords(near, found) }] : [],
        place: {
          within: "within",
          placeholder: copy.nearPlaceholder,
          distances: NEAR_MILES.map((n) => ({ value: String(n), label: copy.miles(n) })),
        },
      },
      mp: {
        label: politiciansCopy.politician.roles.commons,
        oneEach: true,
        searchable: true,
        // Any MP, as a broadcast with fields about the reader's MP needs, until something's typed; then the MPs.
        options: [
          { value: ANY_MP, label: copy.anyMp, untyped: true, leftOut: copy.noMp },
          ...mps.map((mp) => ({ value: String(mp.id), label: staffVocabulary.mpChoice(mp.name, mp.constituency) })),
        ],
      },
      nation: {
        label: politiciansCopy.politician.country,
        oneEach: true,
        options: choicesOf(staffVocabulary.countries),
      },
    };
  },
);
