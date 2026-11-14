"use client";

// EventsTable's example that logs what its edit form does (EventsTable.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import EventsTable from "./EventsTable";
import { exampleEventsNow, exampleEventsTab, exampleStaff } from "./EventsTable.examples";

/**
 * The events page's table, on a tab, with a search or filters as typed,
 * (`params`), and its hosts, but without `hosts`, as staff who don't see
 * supporters have it; saving an event's edit form is logged, and with
 * `emailed`, says it emailed the owner chosen and Joseph, the owner before.
 */
export function EventsTableExample({
  params = {},
  emailed = false,
  hosts = true,
}: {
  params?: Parameters<typeof exampleEventsTab>[0];
  emailed?: boolean;
  hosts?: boolean;
}) {
  const { search, found } = exampleEventsTab(params);
  return (
    <Logged>
      {(log) => (
        <EventsTable
          found={found}
          search={search}
          staff={exampleStaff}
          now={exampleEventsNow}
          hosts={hosts}
          save={async (form) => {
            log("save")(form);
            const chosen = String(form.get("owner"));
            return emailed ? { emailed: [chosen, "joseph@pauseai.uk"], owner: chosen } : { emailed: [], owner: null };
          }}
        />
      )}
    </Logged>
  );
}
