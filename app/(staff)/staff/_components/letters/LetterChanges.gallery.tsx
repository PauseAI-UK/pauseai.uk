// LetterChanges in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { exampleEmail } from "./ThreadEmail.gallery";
import { exampleProxiedLetterDetails } from "./LettersTable.examples";
import StaffPage from "../ui/StaffPage";
import LetterChanges from "./LetterChanges";

export const letterChangesGallery: Example[] = [
  {
    name: "LetterChanges",
    file: "app/(staff)/staff/_components/letters/LetterChanges.tsx",
    variants: [
      {
        label:
          "Only what the supporter changed in a long letter, the paragraphs they left alone folded; Show as sent above",
        render: () => (
          <StaffPage as="div">
            <LetterChanges
              {...exampleEmail}
              sent={exampleProxiedLetterDetails.sent!.text}
              draft={exampleProxiedLetterDetails.sent!.draft}
            />
          </StaffPage>
        ),
      },
      {
        label: "No draft kept: the letter alone",
        render: () => (
          <StaffPage as="div">
            <LetterChanges {...exampleEmail} sent={exampleProxiedLetterDetails.sent!.text} draft={null} />
          </StaffPage>
        ),
      },
    ],
  },
];
