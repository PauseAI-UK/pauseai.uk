// EventsTable in the component gallery (app/(tools)/gallery/), in the staff mailings
// and events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { eventsCopy } from "@/lib/events/copy";
import PageHead from "../ui/PageHead";
import StaffPage from "../ui/StaffPage";
import { EventGroups, EventsIntro, EventTabs, Missing } from "./EventsTable";
import { exampleEventsTab } from "./EventsTable.examples";
import { EventsTableExample } from "./EventsTable.gallery.client";

export const eventsTableGallery: Example[] = [
  {
    name: "EventsTable",
    file: "app/(staff)/staff/_components/events/EventsTable.tsx",
    variants: [
      {
        label:
          "Future: one with its Google Doc and three hosts, one linked, one not and one with no name; one with no owner or doc, in red",
        render: () => (
          <StaffPage as="div">
            <EventsTableExample />
          </StaffPage>
        ),
      },
      {
        label: "Past, latest first: one with no owner or doc, said only, and one taken off Luma",
        render: () => (
          <StaffPage as="div">
            <EventsTableExample params={{ when: "past" }} />
          </StaffPage>
        ),
      },
      {
        label: "Past, sorted by how many are going",
        render: () => (
          <StaffPage as="div">
            <EventsTableExample params={{ when: "past", sort: "going", dir: "desc" }} />
          </StaffPage>
        ),
      },
      {
        label: "Searched by a host's email, whose address isn't shown",
        render: () => (
          <StaffPage as="div">
            <EventsTableExample params={{ q: "john.smith@example" }} />
          </StaffPage>
        ),
      },
      {
        label: "Without the supporters permission: no hosts",
        render: () => (
          <StaffPage as="div">
            <EventsTableExample hosts={false} />
          </StaffPage>
        ),
      },
      {
        label: "Filters that find none",
        render: () => (
          <StaffPage as="div">
            <EventsTableExample params={{ q: "nothing like this" }} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "EventTabs",
    file: "app/(staff)/staff/_components/events/EventsTable.tsx",
    variants: [
      {
        label: "On Past, with a filter on, which Future keeps too",
        render: () => (
          <StaffPage as="div">
            <EventTabs search={exampleEventsTab({ when: "past", tag: "London" }).search} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "EventGroups",
    file: "app/(staff)/staff/_components/events/EventsTable.tsx",
    variants: [
      {
        label: "As a table",
        render: () => (
          <StaffPage as="div">
            <EventGroups search={exampleEventsTab().search} />
          </StaffPage>
        ),
      },
      {
        label: "In lists by owner",
        render: () => (
          <StaffPage as="div">
            <EventGroups search={exampleEventsTab({ group: "owner" }).search} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "Missing",
    file: "app/(staff)/staff/_components/events/EventsTable.tsx",
    variants: [
      {
        label: "What an event to come lacks: an error",
        render: () => (
          <StaffPage as="div">
            <Missing needed>{eventsCopy.events.noOwner}</Missing>
          </StaffPage>
        ),
      },
      {
        label: "What an event past lacks: only said",
        render: () => (
          <StaffPage as="div">
            <Missing needed={false}>{eventsCopy.events.noOwner}</Missing>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "EventsIntro",
    file: "app/(staff)/staff/_components/events/EventsTable.tsx",
    variants: [
      {
        label: "Under the events page's title: what it lists, with our Luma calendar linked",
        render: () => (
          <StaffPage as="div">
            <PageHead intro={<EventsIntro />}>Events</PageHead>
          </StaffPage>
        ),
      },
    ],
  },
];
