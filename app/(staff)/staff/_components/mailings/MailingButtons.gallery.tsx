// MailingButtons in the component gallery (app/(tools)/gallery/), in the staff mailings and events
// group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { MailingButtonsExample, ResumeBroadcastExample } from "./MailingButtons.gallery.client";

export const mailingButtonsGallery: Example[] = [
  {
    name: "DeleteDraft",
    file: "app/(staff)/staff/_components/mailings/MailingButtons.tsx",
    variants: [
      {
        label: "Delete draft, which asks to be sure, and Stop",
        render: () => (
          <StaffPage as="div">
            <MailingButtonsExample id={5} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ResumeBroadcast",
    file: "app/(staff)/staff/_components/mailings/MailingButtons.tsx",
    variants: [
      {
        label: "Beside what says a broadcast stopped before it had all gone",
        render: () => (
          <StaffPage as="div">
            <ResumeBroadcastExample id={7} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "StopMailing",
    file: "app/(staff)/staff/_components/mailings/MailingButtons.tsx",
    variants: [
      {
        label: "Beside Delete draft",
        render: () => (
          <StaffPage as="div">
            <MailingButtonsExample id={6} />
          </StaffPage>
        ),
      },
    ],
  },
];
