// MyGmail in the component gallery (app/(tools)/gallery/), in the staff admin
// group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { MyGmailExample } from "./MyGmail.gallery.client";

export const myGmailGallery: Example[] = [
  {
    name: "MyGmail",
    file: "app/(staff)/staff/_components/accounts/MyGmail.tsx",
    variants: [
      {
        label: "Not connected: what connecting means, and the button",
        render: () => (
          <StaffPage as="div">
            <MyGmailExample connected={false} />
          </StaffPage>
        ),
      },
      {
        label: "Just connected, with today's sends, and Disconnect",
        render: () => (
          <StaffPage as="div">
            <MyGmailExample connected outcome="connected" />
          </StaffPage>
        ),
      },
      {
        label: "Connecting failed: the error, then what connecting means again",
        render: () => (
          <StaffPage as="div">
            <MyGmailExample connected={false} outcome="failed" />
          </StaffPage>
        ),
      },
    ],
  },
];
