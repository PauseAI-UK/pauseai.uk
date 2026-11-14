import type { Filter } from "@/lib/staff-list-filters";
import FilterBar from "../ui/FilterBar";
import { emailCopy } from "./copy";

/** The blocked addresses' filter: those that bounced, complained, or are on hold in CiviCRM. */
export function emailBlockFilters(): Filter[] {
  const { columns, kinds } = emailCopy.emails;
  return [
    {
      name: "kind",
      label: columns.kind,
      options: [
        { value: "hard", label: kinds.hard },
        { value: "complaint", label: kinds.complaint },
        { value: "hold", label: kinds.hold },
      ],
    },
  ];
}

/** Which blocked addresses the page at `action` lists: those like a search, and by its filter. */
export default function EmailBlockFilters({ q, kind, action }: { q: string; kind: string; action: string }) {
  return (
    <FilterBar
      path={action}
      values={{ q, kind }}
      search={{ name: "q", label: emailCopy.emails.columns.address }}
      filters={emailBlockFilters()}
    />
  );
}
