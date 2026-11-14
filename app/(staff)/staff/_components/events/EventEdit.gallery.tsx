// EventEdit in the component gallery (app/(tools)/gallery/), in the staff mailings
// and events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { EventsTableExample } from "./EventsTable.gallery.client";

export const eventEditGallery: Example[] = [
  {
    name: "EventsEditing",
    file: "app/(staff)/staff/_components/events/EventEdit.tsx",
    variants: [
      {
        label: "In the events table: press an event's Edit for the bubble to change its owner and doc",
        render: () => (
          <StaffPage as="div">
            <EventsTableExample emailed />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "EventEdit",
    file: "app/(staff)/staff/_components/events/EventEdit.tsx",
    variants: [
      {
        label: "In the events table: press an event's Edit for the bubble to change its owner and doc",
        render: () => (
          <StaffPage as="div">
            <EventsTableExample emailed />
          </StaffPage>
        ),
      },
    ],
  },
];
