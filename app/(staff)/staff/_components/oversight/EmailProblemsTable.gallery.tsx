// EmailProblemsTable in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import EmailProblemsTable from "./EmailProblemsTable";
import { exampleProblems } from "./EmailBlocksTable.examples";
import StaffPage from "../ui/StaffPage";

export const emailProblemsTableGallery: Example[] = [
  {
    name: "EmailProblemsTable",
    file: "app/(staff)/staff/_components/oversight/EmailProblemsTable.tsx",
    variants: [
      {
        label: "A letter's hard bounce, a forwarded reply's soft one, and a complaint about an email we didn't log",
        render: () => (
          <StaffPage as="div">
            <EmailProblemsTable problems={exampleProblems} letterLinks />
          </StaffPage>
        ),
      },
      {
        label: "Without the supporters permission: the letter named, not linked",
        render: () => (
          <StaffPage as="div">
            <EmailProblemsTable problems={exampleProblems} letterLinks={false} />
          </StaffPage>
        ),
      },
      {
        label: "None",
        render: () => (
          <StaffPage as="div">
            <EmailProblemsTable problems={[]} letterLinks />
          </StaffPage>
        ),
      },
    ],
  },
];
