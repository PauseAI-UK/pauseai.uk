// AskView in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import AskView from "./AskView";
import { exampleAskPage } from "./AsksList.examples";

export const askViewGallery: Example[] = [
  {
    name: "AskView",
    file: "app/(staff)/staff/_components/campaigns/AskView.tsx",
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
];
