// ReplyReactions in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { ReplyReactionsExample } from "./ReplyReactions.gallery.client";

export const replyReactionsGallery: Example[] = [
  {
    name: "ReplyReactions",
    file: "app/(staff)/staff/_components/broadcasts/ReplyReactions.tsx",
    variants: [
      {
        label: "Their latest message on WhatsApp, the smiley beside it to put an emoji on it, none yet",
        render: () => (
          <StaffPage as="div">
            <ReplyReactionsExample />
          </StaffPage>
        ),
      },
      {
        label: "Ours on their message, with who put it there and when",
        render: () => (
          <StaffPage as="div">
            <ReplyReactionsExample reacted />
          </StaffPage>
        ),
      },
      {
        label: "Ours, which WhatsApp couldn't deliver",
        render: () => (
          <StaffPage as="div">
            <ReplyReactionsExample undelivered />
          </StaffPage>
        ),
      },
      {
        label: "One that didn't go",
        render: () => (
          <StaffPage as="div">
            <ReplyReactionsExample refused />
          </StaffPage>
        ),
      },
      {
        label: "Ours on a message too old for another, or not their latest: no smiley",
        render: () => (
          <StaffPage as="div">
            <ReplyReactionsExample reacted tooOld />
          </StaffPage>
        ),
      },
    ],
  },
];
