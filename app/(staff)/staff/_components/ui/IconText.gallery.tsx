// IconText in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ChannelIcon from "@/components/ui/ChannelIcon";
import IconText from "./IconText";
import { Muted } from "@/components/ui/Text";
import StaffPage from "./StaffPage";

export const iconTextGallery: Example[] = [
  {
    name: "IconText",
    file: "app/(staff)/staff/_components/ui/IconText.tsx",
    variants: [
      {
        label: "An icon before words, centred on them: in a paragraph, small and muted, and in a heading",
        render: () => (
          <StaffPage as="div">
            <p>
              Sent by <IconText icon={<ChannelIcon channel="email" />}>Email</IconText> and{" "}
              <IconText icon={<ChannelIcon channel="phone" />}>Text</IconText> today.
            </p>
            <p>
              <Muted>
                <IconText icon={<ChannelIcon channel="phone" />}>Text</IconText>
              </Muted>
            </p>
            <h3>
              <IconText icon={<ChannelIcon channel="email" />}>Email</IconText>
            </h3>
          </StaffPage>
        ),
      },
    ],
  },
];
