// MailFold in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import MailFold from "./MailFold";

export const mailFoldGallery: Example[] = [
  {
    name: "MailFold",
    file: "app/(staff)/staff/_components/letters/MailFold.tsx",
    variants: [
      {
        label: "Folded, as it first shows",
        render: () => (
          <StaffPage as="div">
            <MailFold summary="2 paragraphs unchanged">{"Dear Jo,\n\nI'm writing about the bill."}</MailFold>
          </StaffPage>
        ),
      },
    ],
  },
];
