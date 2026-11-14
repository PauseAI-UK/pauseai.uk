// FindInGmail in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { examplePauseaiLetterDetails, exampleSupporterLetterDetails } from "./LettersTable.examples";
import FindInGmail from "./FindInGmail";
import StaffPage from "../ui/StaffPage";

export const findInGmailGallery: Example[] = [
  {
    name: "FindInGmail",
    file: "app/(staff)/staff/_components/letters/FindInGmail.tsx",
    variants: [
      {
        label: "A letter sent from policy@: copies the search for it, then says to paste it where policy@'s mail is",
        render: () => (
          <StaffPage as="div">
            <FindInGmail find={{ mailbox: "policy@pauseai.uk", search: "rfc822msgid:4f1c@pauseai.uk" }} />
          </StaffPage>
        ),
      },
      {
        label: "A supporter's letter sent while policy@ was a Google Group: paste it where its members' mail is",
        render: () => (
          <StaffPage as="div">
            <FindInGmail find={exampleSupporterLetterDetails.gmail} />
          </StaffPage>
        ),
      },
      {
        label: "One copied from Airtable, from a mailbox we don't know",
        render: () => (
          <StaffPage as="div">
            <FindInGmail find={examplePauseaiLetterDetails.gmail} />
          </StaffPage>
        ),
      },
    ],
  },
];
