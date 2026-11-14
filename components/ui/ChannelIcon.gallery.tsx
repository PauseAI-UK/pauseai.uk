// ChannelIcon in the component gallery (app/(tools)/gallery/), in the staff interface: supporters (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ChannelIcon from "@/components/ui/ChannelIcon";
import StaffPage from "@/app/(staff)/staff/_components/ui/StaffPage";

export const channelIconGallery: Example[] = [
  {
    name: "ChannelIcon",
    file: "components/ui/ChannelIcon.tsx",
    variants: [
      {
        label: "Email and phone, named, and as decoration",
        render: () => (
          <StaffPage as="div">
            <p>
              <ChannelIcon channel="email" label="Email" /> <ChannelIcon channel="phone" label="Phone" />{" "}
              <ChannelIcon channel="email" /> <ChannelIcon channel="phone" />
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
