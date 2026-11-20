// MailingsOverview in the component gallery (app/(tools)/gallery/), in the staff mailings and
// events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { MailingsOverviewExample } from "./MailingsOverview.gallery.client";

export const mailingsOverviewGallery: Example[] = [
  {
    name: "MailingsOverview",
    file: "app/(staff)/staff/_components/mailings/MailingsOverview.tsx",
    variants: [
      {
        label:
          "One scheduled, one sending and two drafts, each under its heading; then October, June and 2025, each sent row a box of counts",
        render: () => (
          <StaffPage as="div">
            <MailingsOverviewExample />
          </StaffPage>
        ),
      },
      {
        label: "No mailings at all",
        render: () => (
          <StaffPage as="div">
            <MailingsOverviewExample empty />
          </StaffPage>
        ),
      },
    ],
  },
];
