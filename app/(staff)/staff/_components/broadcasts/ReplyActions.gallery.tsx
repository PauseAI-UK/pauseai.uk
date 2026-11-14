// ReplyActions in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { ReplyActionsExample, ReplyButtonExample } from "./ReplyActions.gallery.client";

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
  {
    name: "ReplyButton",
    file: "app/(staff)/staff/_components/broadcasts/ReplyActions.tsx",
    variants: [
      {
        label: "Reply, in orange, which opens a reply's answer",
        render: () => (
          <StaffPage as="div">
            <ReplyButtonExample />
          </StaffPage>
        ),
      },
    ],
  },
];
