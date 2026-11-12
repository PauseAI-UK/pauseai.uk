// The staff interface's supporter pages: the list and its filters, a
// supporter's details, notes and erasure, on fake supporters.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import { NoteFrom } from "@/app/(staff)/staff/_components/Notes";
import EraseLink from "@/app/(staff)/staff/_components/EraseLink";
import ErasedNotice from "@/app/(staff)/staff/_components/ErasedNotice";
import { LumaReading } from "@/app/(staff)/staff/_components/SignupUploadPreview";
import SupporterBadges from "@/app/(staff)/staff/_components/SupporterBadges";
import SubscriptionBadges from "@/app/(staff)/staff/_components/SubscriptionBadges";
import ChannelIcon from "@/components/ui/ChannelIcon";
import SupporterDetails from "@/app/(staff)/staff/_components/SupporterDetails";
import SupporterFilters from "@/app/(staff)/staff/_components/SupporterFilters";
import SupportersTable from "@/app/(staff)/staff/_components/SupportersTable";
import {
  exampleMemberDetails,
  exampleSupporter,
  exampleSupporterRows,
  exampleSupporterDetails,
} from "@/app/(staff)/staff/_components/SupportersTable.examples";
import { SignupColumnNames } from "@/app/(staff)/staff/_components/SignupUploadHelp";
import SignupUploadResult, {
  SignupUploadHead,
  SignupUploadsList,
} from "@/app/(staff)/staff/_components/SignupUploadResult";
import { exampleSignupUpload, exampleSignupUploadPeople } from "@/app/(staff)/staff/_components/SignupUpload.examples";
import { supportersSearch } from "@/lib/staff-search";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import type { Group } from "../_components/types";
import {
  EraseFormExample,
  NotesExample,
  NoteChangesExample,
  NoteEntryExample,
  NoteFormExample,
  NotesCardExample,
  OptOutFormExample,
  NoteTextExample,
  SignupPlanViewExample,
  SignupUploadFormExample,
  SignupUploadHelpExample,
  SignupUploadPreviewExample,
} from "./staff.client";

/** Luma events a filter of supporters picks from, newest first. */
const exampleEventChoices = [
  { id: "evt-1", name: "PauseAI Leicester meetup", startAt: new Date("2026-10-20T18:00:00Z") },
  { id: "evt-2", name: "AI risk talk", startAt: new Date("2026-10-12T18:00:00Z") },
  { id: "evt-3", name: "PauseAI London March", startAt: new Date("2026-09-05T11:00:00Z") },
];

export const staffSupporters: Group = {
  id: "staff-supporters",
  title: "The staff interface: supporters",
  examples: [
    {
      name: "SupporterFilters",
      file: "app/(staff)/staff/_components/SupporterFilters.tsx",
      variants: [
        {
          label: "The list's filters, with a search typed, two activities, a campaign not written in, and near Leeds",
          render: () => (
            <StaffPage as="div">
              <SupporterFilters
                search={supportersSearch({
                  q: "jane",
                  activity: ["registered", "member"],
                  contact: "email:events:unsubscribed",
                  campaign: "support-sobel-bill",
                  wrote: "no",
                  mp: "!7",
                  near: "LS1",
                  within: "25",
                  sort: "name",
                })}
                choices={{
                  events: exampleEventChoices,
                  mps: [{ id: 7, name: "Alex Sobel", constituency: "Leeds Central and Headingley" }],
                }}
                near={{ latitude: 53.8, longitude: -1.55, place: "Leeds", country: "england" }}
              />
            </StaffPage>
          ),
        },
        {
          label: "Choosing who a broadcast goes to: its Consent locked",
          render: () => (
            <StaffPage as="div">
              <SupporterFilters
                search={supportersSearch({ contact: "email:newsletter:yes", near: "LS1", broadcast: "3" })}
                choices={{ events: exampleEventChoices, mps: [] }}
                lockConsent
              />
            </StaffPage>
          ),
        },
        {
          label: "Near somewhere postcodes.io doesn't know",
          render: () => (
            <StaffPage as="div">
              <SupporterFilters
                search={supportersSearch({ near: "Atlantis" })}
                choices={{ events: [], mps: [] }}
                near={null}
              />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "SupportersTable",
      file: "app/(staff)/staff/_components/SupportersTable.tsx",
      variants: [
        {
          label: "Three supporters, one page of three",
          render: () => (
            <StaffPage as="div">
              <SupportersTable
                search={supportersSearch({ page: "2" })}
                page={{
                  supporters: exampleSupporterRows,
                  total: 120,
                  pages: 3,
                }}
              />
            </StaffPage>
          ),
        },
        {
          label: "Nobody found",
          render: () => (
            <StaffPage as="div">
              <SupportersTable search={supportersSearch({})} page={{ supporters: [], total: 0, pages: 1 }} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "SupporterBadges",
      file: "app/(staff)/staff/_components/SupporterBadges.tsx",
      variants: [
        {
          label: "A calendar contact who registered twice and wrote to their MP",
          render: () => (
            <StaffPage as="div">
              <SupporterBadges supporter={exampleSupporter} />
            </StaffPage>
          ),
        },
        {
          label: "A member",
          render: () => (
            <StaffPage as="div">
              <SupporterBadges supporter={exampleMemberDetails.summary} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "SubscriptionBadges",
      file: "app/(staff)/staff/_components/SubscriptionBadges.tsx",
      variants: [
        {
          label: "Agreed on their letter, unsubscribed from the calendar's emails",
          render: () => (
            <StaffPage as="div">
              <SubscriptionBadges permissions={exampleSupporterRows[0].permissions} />
            </StaffPage>
          ),
        },
        {
          label: "On the calendar; can't be sure of the updates",
          render: () => (
            <StaffPage as="div">
              <SubscriptionBadges permissions={exampleSupporterRows[1].permissions} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ChannelIcon",
      file: "components/ui/ChannelIcon.tsx",
      variants: [
        {
          label: "Email and phone, named, and as decoration",
          render: () => (
            <StaffPage as="div">
              <p>
                <ChannelIcon channel="email" label="Email" /> <ChannelIcon channel="phone" label="Phone" />{" "}
                <ChannelIcon channel="email" /> <ChannelIcon channel="phone" />
              </p>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "SupporterDetails",
      file: "app/(staff)/staff/_components/SupporterDetails.tsx",
      variants: [
        {
          label: "A supporter known from Luma and a letter, opted out on one address",
          render: () => (
            <StaffPage as="div">
              <SupporterDetails supporter={exampleSupporterDetails} />
            </StaffPage>
          ),
        },
        {
          label: "A member who opted out of the updates on joining, then asked for them on re-joining",
          render: () => (
            <StaffPage as="div">
              <SupporterDetails supporter={exampleMemberDetails} />
            </StaffPage>
          ),
        },
        {
          label: "A supporter with no name, nothing given and no activity",
          render: () => (
            <StaffPage as="div">
              <SupporterDetails
                supporter={{
                  mp: null,
                  letters: [],
                  summary: {
                    ...exampleSupporter,
                    name: null,
                    emails: ["x@example.com"],
                    events: 0,
                    letters: 0,
                    lumaContact: false,
                  },
                  identities: [{ source: "luma", email: "x@example.com", name: "", seenAt: null }],
                  contacts: [],
                  activity: [],
                  permissions: [],
                }}
              />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "EraseForm",
      file: "app/(staff)/staff/_components/EraseForm.tsx",
      variants: [
        {
          label: "The erase page's form",
          render: () => (
            <StaffPage as="div">
              <EraseFormExample />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "ErasedNotice",
      file: "app/(staff)/staff/_components/ErasedNotice.tsx",
      variants: [
        {
          label: "Done",
          render: () => (
            <StaffPage as="div">
              <ErasedNotice erased="1" />
            </StaffPage>
          ),
        },
        {
          label: "Erased, but something couldn't be cleared",
          render: () => (
            <StaffPage as="div">
              <ErasedNotice erased="partly" why="mail,oneOffs" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "EraseLink",
      file: "app/(staff)/staff/_components/EraseLink.tsx",
      variants: [
        {
          label: "At the foot of a supporter's page",
          render: () => (
            <StaffPage as="div">
              <EraseLink supporterId={7} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "Notes",
      file: "app/(staff)/staff/_components/Notes.tsx",
      variants: [
        {
          label: "A supporter's notes, as their writer sees them: her newest she can still change",
          render: () => (
            <StaffPage as="div">
              <NotesExample />
            </StaffPage>
          ),
        },
        {
          label: "As an admin, who can delete any",
          render: () => (
            <StaffPage as="div">
              <NotesExample as="admin" />
            </StaffPage>
          ),
        },
        {
          label: "None yet",
          render: () => (
            <StaffPage as="div">
              <NotesExample as="empty" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "NoteEntry",
      file: "app/(staff)/staff/_components/Notes.tsx",
      variants: [
        { label: "In a history: her own, which she can change", render: () => <NoteEntryExample /> },
        { label: "Someone else's, edited", render: () => <NoteEntryExample own={false} /> },
      ],
    },
    {
      name: "NoteChanges",
      file: "app/(staff)/staff/_components/NoteChanges.tsx",
      variants: [
        { label: "Its writer's: Edit, which opens Save, Cancel and Delete", render: () => <NoteChangesExample /> },
        { label: "An admin's, on someone else's: Delete alone", render: () => <NoteChangesExample editable={false} /> },
      ],
    },
    {
      name: "NoteFrom",
      file: "app/(staff)/staff/_components/Notes.tsx",
      variants: [
        {
          label: "A note kept somewhere else: its text, then where it's from",
          render: () => (
            <StaffPage as="div">
              <NoteFrom
                body={"Met at the example fair.\nRecommended by the local group."}
                source="Notes from Airtable"
              />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "NotesCard",
      file: "app/(staff)/staff/_components/NotesCard.tsx",
      variants: [
        {
          label: "With Write a note, which drafts one at the top",
          render: () => (
            <StaffPage as="div">
              <NotesCardExample />
            </StaffPage>
          ),
        },
        {
          label: "No notes yet",
          render: () => (
            <StaffPage as="div">
              <NotesCardExample lines={false} />
            </StaffPage>
          ),
        },
        {
          label: "Without Write a note",
          render: () => (
            <StaffPage as="div">
              <NotesCardExample writable={false} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "NoteForm",
      file: "app/(staff)/staff/_components/NoteForm.tsx",
      variants: [
        { label: "Closed: the button that opens it", render: () => <NoteFormExample /> },
        { label: "Opened, on a supporter, with what a note should be", render: () => <NoteFormExample opened /> },
        { label: "Opened, on a politician", render: () => <NoteFormExample on="politicianId" opened /> },
      ],
    },
    {
      name: "OptOutForm",
      file: "app/(staff)/staff/_components/OptOutForm.tsx",
      variants: [
        { label: "Closed: the button that opens it", render: () => <OptOutFormExample /> },
        {
          label: "Opened: what of, at which address or number, and how they told us",
          render: () => <OptOutFormExample opened />,
        },
      ],
    },
    {
      name: "NoteText",
      file: "app/(staff)/staff/_components/Notes.tsx",
      variants: [{ label: "With addresses, as links, on two lines", render: () => <NoteTextExample /> }],
    },
    {
      name: "SignupUploadForm",
      file: "app/(staff)/staff/_components/SignupUploadForm.tsx",
      variants: [{ label: "Before a file: its four steps", render: () => <SignupUploadFormExample /> }],
    },
    {
      name: "SignupUploadHelp",
      file: "app/(staff)/staff/_components/SignupUploadHelp.tsx",
      variants: [
        {
          label: "What the file needs, and the button that opens every name",
          render: () => <SignupUploadHelpExample />,
        },
      ],
    },
    {
      name: "SignupColumnNames",
      file: "app/(staff)/staff/_components/SignupUploadHelp.tsx",
      variants: [{ label: "Every column name, and its values", render: () => <SignupColumnNames /> }],
    },
    {
      name: "SignupPlanView",
      file: "app/(staff)/staff/_components/SignupUploadPreview.tsx",
      variants: [
        {
          label:
            "Someone in every pile, one emailed how to lift “No bulk emails”, with the email they'll get, and one with “Do not email”",
          render: () => <SignupPlanViewExample />,
        },
      ],
    },
    {
      name: "LumaReading",
      file: "app/(staff)/staff/_components/SignupUploadPreview.tsx",
      variants: [{ label: "On an import's page, while Luma's read", render: () => <LumaReading /> }],
    },
    {
      name: "SignupUploadPreview",
      file: "app/(staff)/staff/_components/SignupUploadPreview.tsx",
      variants: [{ label: "Worked out, with someone in every pile", render: () => <SignupUploadPreviewExample /> }],
    },
    {
      name: "SignupUploadResult",
      file: "app/(staff)/staff/_components/SignupUploadResult.tsx",
      variants: [
        {
          label: "With what Luma said of each",
          render: () => <SignupUploadResult upload={exampleSignupUploadPeople} />,
        },
        {
          label: "Just imported, while the Luma import it started reads the event's guests",
          render: () => <SignupUploadResult upload={{ ...exampleSignupUploadPeople, lumaReading: true }} />,
        },
        {
          label: "Everyone since erased, with no event or note",
          render: () => (
            <SignupUploadResult
              upload={{ ...exampleSignupUpload, eventName: null, note: null, people: [], lumaReading: false }}
            />
          ),
        },
      ],
    },
    {
      name: "SignupUploadHead",
      file: "app/(staff)/staff/_components/SignupUploadResult.tsx",
      variants: [
        {
          label: "An upload's file, and under it what came of it, with its event and where it was collected",
          render: () => (
            <StaffPage as="div">
              <SignupUploadHead upload={exampleSignupUpload} />
            </StaffPage>
          ),
        },
        {
          label: "With no event or note",
          render: () => (
            <StaffPage as="div">
              <SignupUploadHead upload={{ ...exampleSignupUpload, eventName: null, note: null }} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "SignupUploadsList",
      file: "app/(staff)/staff/_components/SignupUploadResult.tsx",
      variants: [
        {
          label: "This year's and last year's, by the date on the forms",
          render: () => (
            <SignupUploadsList
              now="2026-11-07T12:00:00Z"
              uploads={[
                exampleSignupUpload,
                { ...exampleSignupUpload, id: 2, signedOn: "2025-06-14", note: null, eventName: null, heldBack: 0 },
              ]}
            />
          ),
        },
        { label: "None yet", render: () => <SignupUploadsList now="2026-11-07T12:00:00Z" uploads={[]} /> },
      ],
    },
  ],
};
