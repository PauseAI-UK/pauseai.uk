import type { Filter } from "@/lib/staff-list-filters";
import { BACKENDS, FOUND_BY } from "@/lib/email/block-filters";
import ChannelIcon from "@/components/ui/ChannelIcon";
import type { BlocksSearch } from "@/lib/staff-search";
import FilterBar from "../ui/FilterBar";
import { emailCopy } from "./copy";

/**
 * The blocked addresses' filters, in their columns' order: what blocked them
 * (a bounce, a complaint, a hold in CiviCRM, or, with `numbers`, WhatsApp
 * refusing a text), who told us (BACKENDS, WhatsApp only with `numbers`), and
 * what was being sent (FOUND_BY).
 */
export function emailBlockFilters(numbers: boolean): Filter[] {
  const { columns, kinds, foundBy, channels, from } = emailCopy.emails;
  const kindsShown = [
    ...["hard", "complaint", "hold"].map((value) => ({ value, channel: "email" as const })),
    ...(numbers ? [{ value: "not-on-whatsapp", channel: "text" as const }] : []),
  ];
  return [
    {
      name: "kind",
      label: columns.kind,
      // Each cause under its channel's heading, with the icon its rows have.
      options: kindsShown.map(({ value, channel }) => ({
        value,
        label: kinds[value],
        group: { label: channels[channel], icon: <ChannelIcon channel={channel} /> },
      })),
    },
    {
      name: "backend",
      label: columns.backend,
      options: BACKENDS.filter((value) => numbers || value !== "whatsapp").map((value) => ({
        value,
        label: from[value],
      })),
    },
    {
      name: "found",
      label: columns.sent,
      options: FOUND_BY.map((value) => ({ value, label: foundBy[value] })),
    },
  ];
}

/** Which blocked addresses, and with `numbers` numbers, the page at `action` lists: those like a search, and by its filters. */
export default function EmailBlockFilters({
  search,
  numbers,
  action,
}: {
  /** The page's URL as typed, its sort kept as the filters change. */
  search: BlocksSearch;
  numbers: boolean;
  action: string;
}) {
  return (
    <FilterBar
      path={action}
      values={search}
      search={{ name: "q", label: emailCopy.emails.columns.address }}
      filters={emailBlockFilters(numbers)}
    />
  );
}
