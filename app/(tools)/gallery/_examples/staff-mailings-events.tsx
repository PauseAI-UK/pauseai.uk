// The staff interface's mailings to politicians and our events: writing,
// scheduling and viewing a mailing, and the events list and its editing.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import { eventColumnsGallery } from "@/app/(staff)/staff/_components/events/EventColumns.gallery";
import { eventEditGallery } from "@/app/(staff)/staff/_components/events/EventEdit.gallery";
import { eventFiltersGallery } from "@/app/(staff)/staff/_components/events/EventFilters.gallery";
import { eventsTableGallery } from "@/app/(staff)/staff/_components/events/EventsTable.gallery";
import { MailingLetter } from "@/app/(staff)/staff/_components/MailingLetter";
import { FilterPills } from "@/app/(staff)/staff/_components/MailingParts";
import {
  exampleMailingLetter,
  examplePickedGroup,
  examplePickedList,
  exampleWriterData,
} from "@/app/(staff)/staff/_components/MailingWriter.examples";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import type { Group } from "../_components/types";
import {
  MailingEditorExample,
  MailingButtonsExample,
  ResumeBroadcastExample,
  ChangeTimeFormExample,
  DueTimeFieldsExample,
  MailingFilesExample,
  MailingForExample,
  MailingsOverviewExample,
  MailingViewExample,
  MailingWriterExample,
} from "./staff.client";

// The events' examples, in the order the group shows them.
const [eventsTable, eventTabs, eventGroups, missing, eventsIntro] = eventsTableGallery;
const [eventsList, eventColumns] = eventColumnsGallery;

export const staffMailingsEvents: Group = {
  id: "staff-mailings-events",
  title: "The staff interface: mailings and events",
  examples: [
    {
      name: "MailingEditor",
      file: "app/(staff)/staff/_components/MailingEditor.tsx",
      variants: [
        {
          label: "A letter with a merge field and a part only for those who signed; type { for the fields",
          render: () => (
            <StaffPage as="div">
              <MailingEditorExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MailingFiles",
      file: "app/(staff)/staff/_components/MailingFiles.tsx",
      variants: [
        {
          label: "A draft's: a PDF, an image and a file of no kind to draw, with the box for more",
          render: () => (
            <StaffPage as="div">
              <MailingFilesExample editable />
            </StaffPage>
          ),
        },
        {
          label: "A mailing sent's, to open",
          render: () => (
            <StaffPage as="div">
              <MailingFilesExample editable={false} />
            </StaffPage>
          ),
        },
      ],
    },
    eventsTable,
    eventTabs,
    eventGroups,
    eventsList,
    missing,
    eventColumns,
    ...eventFiltersGallery,
    ...eventEditGallery,
    eventsIntro,
    {
      name: "MailingsOverview",
      file: "app/(staff)/staff/_components/MailingsOverview.tsx",
      variants: [
        {
          label:
            "Coming up: one sending, one scheduled and two drafts; then October, June and 2025, each sent row a box of counts",
          render: () => (
            <StaffPage as="div">
              <MailingsOverviewExample />
            </StaffPage>
          ),
        },
        {
          label: "No mailings at all",
          render: () => (
            <StaffPage as="div">
              <MailingsOverviewExample empty />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MailingWriter",
      file: "app/(staff)/staff/_components/MailingWriter.tsx",
      variants: [
        {
          label: "A draft just made, four ticked, nothing written yet: a greeting to start",
          render: () => (
            <StaffPage as="div">
              <MailingWriterExample draft={false} />
            </StaffPage>
          ),
        },
        {
          label: "Jo's draft of it, with a file, from Jo, on 1 December",
          render: () => (
            <StaffPage as="div">
              <MailingWriterExample draft />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MailingView",
      file: "app/(staff)/staff/_components/MailingView.tsx",
      variants: [
        {
          label: "One imported from Airtable: who got it and how it was written, no text",
          render: () => (
            <StaffPage as="div">
              <MailingViewExample state="imported" />
            </StaffPage>
          ),
        },
        {
          label: "Scheduled, with Change the time and Stop",
          render: () => (
            <StaffPage as="div">
              <MailingViewExample state="scheduled" />
            </StaffPage>
          ),
        },
        {
          label: "Sending, with how far it's got",
          render: () => (
            <StaffPage as="div">
              <MailingViewExample state="sending" />
            </StaffPage>
          ),
        },
        {
          label: "Sent, with its counts and recipients",
          render: () => (
            <StaffPage as="div">
              <MailingViewExample state="sent" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MailingFor",
      file: "app/(staff)/staff/_components/MailingFor.tsx",
      variants: [
        {
          label: "A draft",
          render: () => (
            <StaffPage as="div">
              <MailingForExample kind="draft" />
            </StaffPage>
          ),
        },
        {
          label: "One sent",
          render: () => (
            <StaffPage as="div">
              <MailingForExample kind="written" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "MailingLetter",
      file: "app/(staff)/staff/_components/MailingLetter.tsx",
      variants: [
        {
          label: "A letter with fields, a part only for some, bold, italic and a list",
          render: () => (
            <StaffPage as="div">
              <MailingLetter doc={exampleMailingLetter} fields={{ salutation: "Salutation" }} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "FilterPills",
      file: "app/(staff)/staff/_components/MailingParts.tsx",
      variants: [
        {
          label: "The Commons who aren't Labour, who answered an ask",
          render: () => (
            <StaffPage as="div">
              <FilterPills data={exampleWriterData} />
            </StaffPage>
          ),
        },
        {
          label: "Everyone in office",
          render: () => (
            <StaffPage as="div">
              <FilterPills data={{ ...exampleWriterData, filter: { list: "politicians", params: {} } }} />
            </StaffPage>
          ),
        },
        {
          label: "Ticked from a filter's group on a day, with one added and one taken off since",
          render: () => (
            <StaffPage as="div">
              <FilterPills data={examplePickedGroup} />
            </StaffPage>
          ),
        },
        {
          label: "Ticked one by one: their names",
          render: () => (
            <StaffPage as="div">
              <FilterPills data={examplePickedList} />
            </StaffPage>
          ),
        },
        {
          label: "No one ticked yet",
          render: () => (
            <StaffPage as="div">
              <FilterPills
                data={{ ...examplePickedList, filter: { list: "politicians", params: {}, picked: { ids: [] } } }}
              />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "DueTimeFields",
      file: "app/(staff)/staff/_components/DueTime.tsx",
      variants: [
        {
          label: "Today, no hour yet: the hours too soon greyed out",
          render: () => (
            <StaffPage as="div">
              <DueTimeFieldsExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ChangeTimeForm",
      file: "app/(staff)/staff/_components/DueTime.tsx",
      variants: [
        {
          label: "A time become too soon, moved on to the first it can go",
          render: () => (
            <StaffPage as="div">
              <ChangeTimeFormExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "DeleteDraft",
      file: "app/(staff)/staff/_components/MailingButtons.tsx",
      variants: [
        {
          label: "Delete draft, which asks to be sure, and Stop",
          render: () => (
            <StaffPage as="div">
              <MailingButtonsExample id={5} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ResumeBroadcast",
      file: "app/(staff)/staff/_components/MailingButtons.tsx",
      variants: [
        {
          label: "Beside what says a broadcast stopped before it had all gone",
          render: () => (
            <StaffPage as="div">
              <ResumeBroadcastExample id={7} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "StopMailing",
      file: "app/(staff)/staff/_components/MailingButtons.tsx",
      variants: [
        {
          label: "Beside Delete draft",
          render: () => (
            <StaffPage as="div">
              <MailingButtonsExample id={6} />
            </StaffPage>
          ),
        },
      ],
    },
  ],
};
