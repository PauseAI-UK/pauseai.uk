// AskLine in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { AskLead, AskPreview, AskTitle } from "./AskLine";
import { exampleAsks } from "./AsksList.examples";

export const askLineGallery: Example[] = [
  {
    name: "AskPreview",
    file: "app/(staff)/staff/_components/campaigns/AskLine.tsx",
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
    file: "app/(staff)/staff/_components/campaigns/AskLine.tsx",
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
    file: "app/(staff)/staff/_components/campaigns/AskLine.tsx",
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
];
