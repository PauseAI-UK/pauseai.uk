// ChannelWriter in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { BroadcastWriterExample } from "./BroadcastWriter.gallery.client";

export const channelWriterGallery: Example[] = [
  {
    name: "ChannelWriter",
    file: "app/(staff)/staff/_components/broadcasts/ChannelWriter.tsx",
    variants: [
      {
        label: "New broadcast: email or text, then its Consent, to choose; all after it greyed, an email's or a text's",
        render: () => (
          <StaffPage as="div">
            <BroadcastWriterExample kind="blank" />
          </StaffPage>
        ),
      },
    ],
  },
];
