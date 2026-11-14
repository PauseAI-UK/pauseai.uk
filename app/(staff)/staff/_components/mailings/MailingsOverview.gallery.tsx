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
          "Coming up: one sending, one scheduled and two drafts; then October, June and 2025, each sent row a box of counts",
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
