// EventColumns in the component gallery (app/(tools)/gallery/), in the staff mailings
// and events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { EventColumnsExample, EventsListExample } from "./EventColumns.gallery.client";

export const eventColumnsGallery: Example[] = [
  {
    name: "EventsList",
    file: "app/(staff)/staff/_components/events/EventColumns.tsx",
    variants: [
      {
        label: "Not online, by owner: what the filters find, in lists, the choice of how at the right of the count",
        render: () => (
          <StaffPage as="div">
            <EventsListExample params={{ group: "owner", place: "!online" }} />
          </StaffPage>
        ),
      },
      {
        label: "Past, by tag: No owner isn't an error once an event's been held",
        render: () => (
          <StaffPage as="div">
            <EventsListExample params={{ when: "past", group: "tag" }} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "EventColumns",
    file: "app/(staff)/staff/_components/events/EventColumns.tsx",
    variants: [
      {
        label: "By owner: No owner first, in red, each line its tags, or city, or Online; a list folded after five",
        render: () => (
          <StaffPage as="div">
            <EventColumnsExample grouping="owner" />
          </StaffPage>
        ),
      },
      {
        label: "By tag: an event in a list for each of its tags, saying its others; places, Big events, Online, No tag",
        render: () => (
          <StaffPage as="div">
            <EventColumnsExample grouping="tag" />
          </StaffPage>
        ),
      },
      {
        label: "With no events to come",
        render: () => (
          <StaffPage as="div">
            <EventColumnsExample grouping="owner" none />
          </StaffPage>
        ),
      },
    ],
  },
];
