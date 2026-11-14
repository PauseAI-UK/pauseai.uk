// OptOutForm in the component gallery (app/(tools)/gallery/), in the staff supporters group (app/(tools)/gallery/_examples/staff-supporters.tsx), and
// UnsubscribeForm in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { ReplyActionsExample } from "@/app/(tools)/gallery/_examples/staff-broadcasts.client";
import StaffPage from "../ui/StaffPage";
import { OptOutFormExample } from "./OptOutForm.gallery.client";

export const optOutFormGallery: Example[] = [
  {
    name: "OptOutForm",
    file: "app/(staff)/staff/_components/supporters/OptOutForm.tsx",
    variants: [
      { label: "Closed: the button that opens it", render: () => <OptOutFormExample /> },
      {
        label: "Opened: what of, at which address or number, and how they told us",
        render: () => <OptOutFormExample opened />,
      },
    ],
  },
  {
    name: "UnsubscribeForm",
    file: "app/(staff)/staff/_components/supporters/OptOutForm.tsx",
    variants: [
      {
        label: "On a reply: Reply before it and Nothing to do after, its form asking nothing of how they told us",
        render: () => (
          <StaffPage as="div">
            <ReplyActionsExample write />
          </StaffPage>
        ),
      },
    ],
  },
];
