// MailingLetter in the component gallery (app/(tools)/gallery/), in the staff mailings and events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { MailingLetter } from "./MailingLetter";
import { exampleMailingLetter } from "./MailingWriter.examples";
import StaffPage from "../ui/StaffPage";

export const mailingLetterGallery: Example[] = [
  {
    name: "MailingLetter",
    file: "app/(staff)/staff/_components/mailings/MailingLetter.tsx",
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
];
