// AskView in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import AskView from "./AskView";
import { exampleAskPage, exampleEventAskPage } from "./AsksList.examples";

export const askViewGallery: Example[] = [
  {
    name: "AskView",
    file: "app/(staff)/staff/_components/asks/AskView.tsx",
    variants: [
      {
        label: "A letter, asked by a campaign and a mailing: those asked first, one retired, then the answers",
        render: () => (
          <StaffPage as="div">
            <AskView ask={exampleAskPage} />
          </StaffPage>
        ),
      },
      {
        label: "An event, each other answer tagged with what it was",
        render: () => (
          <StaffPage as="div">
            <AskView ask={exampleEventAskPage} />
          </StaffPage>
        ),
      },
      {
        label: "An event with no answers and nothing that put it",
        render: () => (
          <StaffPage as="div">
            <AskView
              ask={{
                ...exampleEventAskPage,
                url: "/events",
                counts: {},
                writtenTo: 0,
                ways: [],
                groups: [],
              }}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
