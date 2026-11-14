// MailEmail in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import MailEmail from "./MailEmail";
import StaffPage from "../ui/StaffPage";

export const mailEmailGallery: Example[] = [
  {
    name: "MailEmail",
    file: "app/(staff)/staff/_components/mailings/MailEmail.tsx",
    variants: [
      {
        label: "From and to, and a subject alone",
        render: () => (
          <StaffPage as="div">
            <MailEmail from="jo@pauseai.uk" to="Each politician" subject="A subject">
              <p>The letter.</p>
            </MailEmail>
            <MailEmail subject="Only a subject">
              <p>The letter.</p>
            </MailEmail>
          </StaffPage>
        ),
      },
    ],
  },
];
