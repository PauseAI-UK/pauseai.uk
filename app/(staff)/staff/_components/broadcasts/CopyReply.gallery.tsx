// CopyReply in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { MessageCopyViewExample } from "./MessageCopyView.gallery.client";

export const copyReplyGallery: Example[] = [
  {
    name: "Reply",
    file: "app/(staff)/staff/_components/broadcasts/CopyReply.tsx",
    variants: [
      {
        label: "Replies in a copy's thread: one to deal with, an automatic one, and one answered",
        render: () => <MessageCopyViewExample email replies />,
      },
    ],
  },
];
