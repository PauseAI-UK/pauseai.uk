// MailingEditor in the component gallery (app/(tools)/gallery/), in the staff mailings and events
// group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { MailingEditorExample } from "./MailingEditor.gallery.client";

export const mailingEditorGallery: Example[] = [
  {
    name: "MailingEditor",
    file: "app/(staff)/staff/_components/mailings/MailingEditor.tsx",
    variants: [
      {
        label: "A letter with a merge field and a part only for those who signed; type { for the fields",
        render: () => (
          <StaffPage as="div">
            <MailingEditorExample />
          </StaffPage>
        ),
      },
    ],
  },
];
