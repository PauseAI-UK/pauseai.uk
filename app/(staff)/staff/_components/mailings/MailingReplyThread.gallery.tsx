// MailingReplyThread in the component gallery (app/(tools)/gallery/), in the staff mailings group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { MailingReplyThreadExample } from "./MailingReplyThread.gallery.client";

export const mailingReplyThreadGallery: Example[] = [
  {
    name: "MailingReplyThread",
    file: "app/(staff)/staff/_components/mailings/MailingReplyThread.tsx",
    variants: [
      {
        label: "A reply waiting, which the staff member can answer from its mailbox: Reply and Nothing to do",
        render: () => (
          <StaffPage as="div">
            <MailingReplyThreadExample />
          </StaffPage>
        ),
      },
      {
        label: "A reply waiting that came to another staff member's mailbox: only they can reply, and Nothing to do",
        render: () => (
          <StaffPage as="div">
            <MailingReplyThreadExample canAnswer={false} />
          </StaffPage>
        ),
      },
      {
        label:
          "None waiting: our answer sent from the page, and a reply marked as needing nothing, each saying by whom",
        render: () => (
          <StaffPage as="div">
            <MailingReplyThreadExample dealt />
          </StaffPage>
        ),
      },
    ],
  },
];
