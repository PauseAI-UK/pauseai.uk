// MailingWriter in the component gallery (app/(tools)/gallery/), in the staff mailings and events
// group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { MailingWriterExample } from "./MailingWriter.gallery.client";

export const mailingWriterGallery: Example[] = [
  {
    name: "MailingWriter",
    file: "app/(staff)/staff/_components/mailings/MailingWriter.tsx",
    variants: [
      {
        label: "A draft just made, four ticked, nothing written yet: a greeting to start",
        render: () => (
          <StaffPage as="div">
            <MailingWriterExample draft={false} />
          </StaffPage>
        ),
      },
      {
        label: "Jo's draft of it, with a file, from Jo, on 1 December",
        render: () => (
          <StaffPage as="div">
            <MailingWriterExample draft />
          </StaffPage>
        ),
      },
    ],
  },
];
