// AnswerableReply in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { AnswerableReplyExample } from "./AnswerableReply.gallery.client";

export const answerableReplyGallery: Example[] = [
  {
    name: "AnswerableReply",
    file: "app/(staff)/staff/_components/broadcasts/AnswerableReply.tsx",
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
];
