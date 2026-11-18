// MessageCopyView in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { MessageCopyViewExample } from "./MessageCopyView.gallery.client";

export const messageCopyViewGallery: Example[] = [
  {
    name: "MessageCopyView",
    file: "app/(staff)/staff/_components/broadcasts/MessageCopyView.tsx",
    variants: [
      {
        label: "A text, as the conversation",
        render: () => (
          <StaffPage as="div">
            <MessageCopyViewExample />
          </StaffPage>
        ),
      },
      {
        label: "An email, as the thread",
        render: () => (
          <StaffPage as="div">
            <MessageCopyViewExample email />
          </StaffPage>
        ),
      },
      {
        label: "An email's replies: one to look at, one dealt with, and an automatic one",
        render: () => (
          <StaffPage as="div">
            <MessageCopyViewExample email replies />
          </StaffPage>
        ),
      },
      {
        label:
          "A text's replies by WhatsApp: one answered, one to look at, and one too old for WhatsApp to take an answer to",
        render: () => (
          <StaffPage as="div">
            <MessageCopyViewExample replies pastDay />
          </StaffPage>
        ),
      },
      {
        label:
          "A text's replies that are more than words: a reaction taken back, one to our answer, one whose emoji wasn't kept, a photo, a place, a voice note, and a kind with no name here",
        render: () => (
          <StaffPage as="div">
            <MessageCopyViewExample kinds />
          </StaffPage>
        ),
      },
    ],
  },
];
