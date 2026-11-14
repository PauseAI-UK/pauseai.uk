// The staff interface's politicians and asks: the list, its filters and
// icons, a politician's page, and the asks, on fake politicians.
// Their links go to /staff pages, which send anyone without a session to the
// login page.
import { addAliasFormGallery } from "@/app/(staff)/staff/_components/politicians/AddAliasForm.gallery";
import { pasteFormGallery } from "@/app/(staff)/staff/_components/politicians/PasteForm.gallery";
import { pickBoxGallery } from "@/app/(staff)/staff/_components/politicians/PickBox.gallery";
import { politicianCorrespondenceGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianCorrespondence.gallery";
import { politicianDetailsGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianDetails.gallery";
import { politicianFiltersGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianFilters.gallery";
import { politicianIconsGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianIcons.gallery";
import { politicianMarksGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianMarks.gallery";
import { politicianTableGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianTable.gallery";
import { politicianWritingGallery } from "@/app/(staff)/staff/_components/politicians/PoliticianWriting.gallery";
import { politiciansListGallery } from "@/app/(staff)/staff/_components/politicians/PoliticiansList.gallery";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";
import {
  exampleAsks,
  exampleAsksWithCounts,
} from "@/app/(staff)/staff/_components/politicians/PoliticianTable.examples";
import AskView from "@/app/(staff)/staff/_components/AskView";
import { exampleAskPage } from "@/app/(staff)/staff/_components/CampaignPages.examples";
import AnswerWord from "@/app/(staff)/staff/_components/AnswerWord";
import AskWays from "@/app/(staff)/staff/_components/AskWays";
import AskKindIcon from "@/app/(staff)/staff/_components/AskKindIcon";
import AsksList from "@/app/(staff)/staff/_components/AsksList";
import { AskLead, AskPreview, AskTitle } from "@/app/(staff)/staff/_components/AskLine";
import type { Group } from "../_components/types";
import { AskRowExample, AskFormExample } from "./staff.client";

const [houseTabs, choosingHead, politiciansList] = politiciansListGallery;

export const staffPoliticians: Group = {
  id: "staff-politicians",
  title: "The staff interface: politicians and asks",
  examples: [
    houseTabs,
    choosingHead,
    ...pasteFormGallery,
    ...pickBoxGallery,
    politiciansList,
    {
      name: "AskRow",
      file: "app/(staff)/staff/_components/AskRow.tsx",
      variants: [
        { label: "An answer from Airtable, and an ask staff record with none yet", render: () => <AskRowExample /> },
        { label: "A letter they declined, crossed", render: () => <AskRowExample declined /> },
      ],
    },
    {
      name: "AskRows",
      file: "app/(staff)/staff/_components/AskRow.tsx",
      variants: [{ label: "Rows of asks, their answers lined up in a column", render: () => <AskRowExample /> }],
    },
    {
      name: "PoliticianAsks",
      file: "app/(staff)/staff/_components/AskRow.tsx",
      variants: [
        {
          label: "A politician's asks: those answered, in order, and the button for another",
          render: () => <AskRowExample others />,
        },
      ],
    },
    ...politicianCorrespondenceGallery,
    ...politicianDetailsGallery,
    ...politicianMarksGallery,
    ...politicianWritingGallery,
    ...addAliasFormGallery,
    ...politicianFiltersGallery,
    {
      name: "AskPreview",
      file: "app/(staff)/staff/_components/AskLine.tsx",
      variants: [
        {
          label: "An event, with a date and a link, before it's answered",
          render: () => (
            <StaffPage as="div">
              <AskPreview ask={exampleAsks[0]} />
            </StaffPage>
          ),
        },
        {
          label: "A letter with no link",
          render: () => (
            <StaffPage as="div">
              <AskPreview ask={{ ...exampleAsks[2], url: null, date: null }} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "AskLead",
      file: "app/(staff)/staff/_components/AskLine.tsx",
      variants: [
        {
          label: "Who asked them to do what, and when, leading into the ask's title",
          render: () => (
            <StaffPage as="div">
              <AskLead ask={exampleAsks[0]} />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "AskTitle",
      file: "app/(staff)/staff/_components/AskLine.tsx",
      variants: [
        {
          label: "Leading to its page",
          render: () => (
            <StaffPage as="div">
              <p>
                <AskTitle ask={exampleAsks[0]} />
              </p>
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "AskForm",
      file: "app/(staff)/staff/_components/AskForm.tsx",
      variants: [
        {
          label: "A new ask",
          render: () => (
            <StaffPage as="div">
              <AskFormExample ask="new" />
            </StaffPage>
          ),
        },
        {
          label: "One staff added, just saved, which nobody has answered: Delete pressed twice",
          render: () => (
            <StaffPage as="div">
              <AskFormExample ask="added" notice="saved" />
            </StaffPage>
          ),
        },
        {
          label: "One politicians have answered: its kind fixed, and it can't be deleted",
          render: () => (
            <StaffPage as="div">
              <AskFormExample ask="answered" notice="in-use" />
            </StaffPage>
          ),
        },
        {
          label: "One the site's code names, which can be changed but not deleted",
          render: () => (
            <StaffPage as="div">
              <AskFormExample ask="named" />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "AskView",
      file: "app/(staff)/staff/_components/AskView.tsx",
      variants: [
        {
          label: "A letter, asked by a campaign and a mailing, answered",
          render: () => (
            <StaffPage as="div">
              <AskView ask={exampleAskPage} answer="" />
            </StaffPage>
          ),
        },
        {
          label: "An event, each other answer tagged with what it was",
          render: () => (
            <StaffPage as="div">
              <AskView
                ask={{
                  ...exampleAskPage,
                  kind: "event",
                  counts: { going: 0, other: 2, declined: 1 },
                  groups: [
                    { key: "going", total: 0, people: [] },
                    {
                      key: "other",
                      total: 2,
                      people: [
                        { ...exampleAskPage.groups[0].people[0], status: "other", note: "Tentatively said yes" },
                        { ...exampleAskPage.groups[2].people[0], status: "other", note: "" },
                      ],
                    },
                    { key: "declined", total: 1, people: exampleAskPage.groups[1].people },
                  ],
                  noAnswer: 0,
                }}
                answer=""
              />
            </StaffPage>
          ),
        },
        {
          label: "A letter, with one answer chosen",
          render: () => (
            <StaffPage as="div">
              <AskView ask={exampleAskPage} answer="signed" />
            </StaffPage>
          ),
        },
        {
          label: "An event with no answers and nothing that put it",
          render: () => (
            <StaffPage as="div">
              <AskView
                ask={{
                  ...exampleAskPage,
                  kind: "event",
                  url: "/events",
                  counts: {},
                  writtenTo: 0,
                  noAnswer: 0,
                  ways: [],
                  groups: [],
                  answers: [],
                }}
                answer=""
              />
            </StaffPage>
          ),
        },
      ],
    },
    {
      name: "AnswerWord",
      file: "app/(staff)/staff/_components/AnswerWord.tsx",
      variants: [
        {
          label: "A yes, a no, one in between, and none",
          render: () => (
            <div style={{ display: "grid" }}>
              <AnswerWord status="signed" />
              <AnswerWord status="declined" />
              <AnswerWord status="other" />
              <AnswerWord status={null} />
            </div>
          ),
        },
      ],
    },
    {
      name: "AskWays",
      file: "app/(staff)/staff/_components/AskWays.tsx",
      variants: [
        { label: "Named", render: () => <AskWays ways={exampleAskPage.ways} /> },
        { label: "Wide, with their letters", render: () => <AskWays ways={exampleAskPage.ways} wide /> },
      ],
    },
    {
      name: "AskKindIcon",
      file: "app/(staff)/staff/_components/AskKindIcon.tsx",
      variants: [
        {
          label: "A letter and an event",
          render: () => (
            <>
              <AskKindIcon kind="letter" />
              <AskKindIcon kind="event" size={16} />
            </>
          ),
        },
      ],
    },
    {
      name: "AsksList",
      file: "app/(staff)/staff/_components/AsksList.tsx",
      variants: [
        {
          label: "Every ask, with its answers",
          render: () => (
            <StaffPage as="div">
              <AsksList asks={exampleAsksWithCounts} now={new Date("2026-10-01T12:00:00Z")} />
            </StaffPage>
          ),
        },
      ],
    },
    ...politicianTableGallery,
    ...politicianIconsGallery,
  ],
};
