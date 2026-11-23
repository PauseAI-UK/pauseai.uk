// AnswerableReply in the component gallery (app/(tools)/gallery/), in the staff mailings group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { AnswerableReplyExample, ReplyButtonExample } from "./AnswerableReply.gallery.client";

export const answerableReplyGallery: Example[] = [
  {
    name: "AnswerableReply",
    file: "app/(staff)/staff/_components/mailings/AnswerableReply.tsx",
    variants: [
      {
        label: "A reply with its Reply button, and its answer opened, being written as it will be sent",
        render: () => (
          <StaffPage as="div">
            <AnswerableReplyExample />
            <AnswerableReplyExample opened />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ReplyButton",
    file: "app/(staff)/staff/_components/mailings/AnswerableReply.tsx",
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
