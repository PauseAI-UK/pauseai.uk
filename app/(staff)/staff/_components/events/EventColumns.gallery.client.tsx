"use client";

// EventColumns' examples that log what their edit forms do (EventColumns.gallery.tsx).
import { Logged } from "@/app/(tools)/gallery/_components/wiring";
import type { EventGrouping } from "@/lib/events/list";
import EventColumns, { EventsList } from "./EventColumns";
import { exampleEventsNow, exampleEventsTab, exampleEventsToCome, exampleStaff } from "./EventsTable.examples";

/** The lists of events to come, by owner or by tag; saving an event's edit form is logged. */
export function EventColumnsExample({ grouping, none = false }: { grouping: EventGrouping; none?: boolean }) {
  return (
    <Logged>
      {(log) => (
        <EventColumns
          events={none ? [] : exampleEventsToCome}
          grouping={grouping}
          staff={exampleStaff}
          now={exampleEventsNow}
          save={async (form) => {
            log("save")(form);
            return { emailed: [], owner: null };
          }}
        />
      )}
    </Logged>
  );
}

/** What the example events' tab and filters find (`params`), as a table or in lists by a grouping; saving an event's edit form is logged. */
export function EventsListExample({ params = {} }: { params?: Parameters<typeof exampleEventsTab>[0] }) {
  const { search, found } = exampleEventsTab(params);
  return (
    <Logged>
      {(log) => (
        <EventsList
          found={found}
          search={search}
          staff={exampleStaff}
          now={exampleEventsNow}
          hosts
          save={async (form) => {
            log("save")(form);
            return { emailed: [], owner: null };
          }}
        />
      )}
    </Logged>
  );
}
