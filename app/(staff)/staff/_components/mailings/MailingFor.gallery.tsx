// MailingFor in the component gallery (app/(tools)/gallery/), in the staff mailings and events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { MailingForExample } from "./MailingFor.gallery.client";

export const mailingForGallery: Example[] = [
  {
    name: "MailingFor",
    file: "app/(staff)/staff/_components/mailings/MailingFor.tsx",
    variants: [
      {
        label: "A draft",
        render: () => (
          <StaffPage as="div">
            <MailingForExample kind="draft" />
          </StaffPage>
        ),
      },
      {
        label: "One sent",
        render: () => (
          <StaffPage as="div">
            <MailingForExample kind="written" />
          </StaffPage>
        ),
      },
    ],
  },
];
