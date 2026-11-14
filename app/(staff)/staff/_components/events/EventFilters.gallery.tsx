// EventFilters in the component gallery (app/(tools)/gallery/), in the staff mailings
// and events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import EventFilters from "./EventFilters";
import { exampleEventsTab, exampleStaff } from "./EventsTable.examples";

export const eventFiltersGallery: Example[] = [
  {
    name: "EventFilters",
    file: "app/(staff)/staff/_components/events/EventFilters.tsx",
    variants: [
      {
        label: "A search typed, a tag, not online, with no owner, and taken off Luma",
        render: () => (
          <StaffPage as="div">
            <EventFilters
              search={
                exampleEventsTab({ q: "social", tag: "Big events", place: "!online", owner: "none", removed: "yes" })
                  .search
              }
              choices={{
                staff: exampleStaff,
                tags: ["Big events", "London", "Online"],
                cities: ["London", "Oxford"],
              }}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
