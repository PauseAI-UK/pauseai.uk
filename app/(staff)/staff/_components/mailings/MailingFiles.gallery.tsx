// MailingFiles in the component gallery (app/(tools)/gallery/), in the staff mailings and events
// group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { MailingFilesExample } from "./MailingFiles.gallery.client";

export const mailingFilesGallery: Example[] = [
  {
    name: "MailingFiles",
    file: "app/(staff)/staff/_components/mailings/MailingFiles.tsx",
    variants: [
      {
        label: "A draft's: a PDF, an image and a file of no kind to draw, with the box for more",
        render: () => (
          <StaffPage as="div">
            <MailingFilesExample editable />
          </StaffPage>
        ),
      },
      {
        label: "A mailing sent's, to open",
        render: () => (
          <StaffPage as="div">
            <MailingFilesExample editable={false} />
          </StaffPage>
        ),
      },
    ],
  },
];
