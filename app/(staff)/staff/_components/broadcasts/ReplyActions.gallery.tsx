// ReplyActions in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { ReplyActionsExample } from "./ReplyActions.gallery.client";

export const replyActionsGallery: Example[] = [
  {
    name: "ReplyActions",
    file: "app/(staff)/staff/_components/broadcasts/ReplyActions.tsx",
    variants: [
      {
        label: "What a reply is: an opt-out of what the email went under, or of all bulk email; or nothing to do",
        render: () => (
          <StaffPage as="div">
            <ReplyActionsExample />
          </StaffPage>
        ),
      },
      {
        label: "To a text: an opt-out of what the text went under, or of every text; or nothing to do",
        render: () => (
          <StaffPage as="div">
            <ReplyActionsExample text />
          </StaffPage>
        ),
      },
    ],
  },
];
