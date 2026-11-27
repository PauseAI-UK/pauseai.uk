// EventRecord in the component gallery (app/(tools)/gallery/), in the staff mailings
// and events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { BroadcastSupportersExample } from "../broadcasts/BroadcastSupporters.gallery.client";
import StaffPage from "../ui/StaffPage";
import EventRecord from "./EventRecord";
import { exampleGuests, exampleGuestsAnsweringNothing } from "./EventRecord.examples";
import { exampleEvents, exampleEventsNow } from "./EventsTable.examples";

const protest = exampleEvents.find((event) => event.id === "evt-protest")!;
const removed = exampleEvents.find((event) => event.id === "evt-social")!;

export const eventRecordGallery: Example[] = [
  {
    name: "EventRecord",
    file: "app/(staff)/staff/_components/events/EventRecord.tsx",
    variants: [
      {
        label: "Its guests, one of each status, some with a postcode, a phone or the link they came by",
        render: () => (
          <StaffPage as="div">
            <EventRecord
              event={protest}
              guests={exampleGuests}
              now={exampleEventsNow}
              broadcast={<BroadcastSupportersExample />}
            />
          </StaffPage>
        ),
      },
      {
        label: "Guests who answered no questions on Luma: no postcode, phone or Came from",
        render: () => (
          <StaffPage as="div">
            <EventRecord
              event={protest}
              guests={exampleGuestsAnsweringNothing}
              now={exampleEventsNow}
              broadcast={<BroadcastSupportersExample />}
            />
          </StaffPage>
        ),
      },
      {
        label: "Taken off Luma, with no owner, no Google Doc and no one registered",
        render: () => (
          <StaffPage as="div">
            <EventRecord event={removed} guests={[]} now={exampleEventsNow} broadcast={null} />
          </StaffPage>
        ),
      },
      {
        label: "For staff who don't see supporters: no hosts or guests",
        render: () => (
          <StaffPage as="div">
            <EventRecord event={{ ...protest, hosts: [] }} guests={null} now={exampleEventsNow} broadcast={null} />
          </StaffPage>
        ),
      },
    ],
  },
];
