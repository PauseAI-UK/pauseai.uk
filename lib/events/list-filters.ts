// The events list's filter bar (lib/staff-list-filters.ts).
import { staffMemberText } from "@/lib/staff-member";
import { WINDOW_OPTIONS } from "@/lib/time-windows";
import { NO_OWNER, ONLINE } from "./list-terms";
import { EVENTS_LIST } from "@/lib/staff-lists";
import { eventsCopy } from "./copy";
import { listFilters, choicesOf } from "@/lib/staff-list-filters";

/** The choices the events list's filters offer: every staff account, and every tag and city our events have. */
export type EventChoices = { staff: readonly string[]; tags: string[]; cities: string[] };

/**
 * The events list's filters, in its columns' order: where it is, a city
 * or online; its tags; its owner, or none; and taken off Luma, which
 * finds only those, as the list leaves them out otherwise, as the
 * politicians list does test politicians; and when it was held, only from the
 * dashboard's tile. Where, tags and owner can be chosen more than once.
 */
export const EVENT_FILTERS = listFilters(EVENTS_LIST, ({ staff, tags, cities }: EventChoices) => {
  const copy = eventsCopy.events;
  return {
    place: {
      label: copy.filters.place,
      oneEach: true,
      options: [...cities.map((city) => ({ value: city, label: city })), { value: ONLINE, label: copy.online }],
    },
    tag: { label: copy.filters.tag, options: tags.map((tag) => ({ value: tag, label: tag })) },
    owner: {
      label: copy.owner,
      oneEach: true,
      options: [
        { value: NO_OWNER, label: copy.noOwner },
        ...staff.map((email) => ({ value: email, label: staffMemberText(email) })),
      ],
    },
    removed: { label: copy.removed, options: choicesOf(copy.filters.removed) },
    held: { label: copy.filters.held, options: WINDOW_OPTIONS, linkedOnly: true },
  };
});
