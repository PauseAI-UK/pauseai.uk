// TickIcon in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import IconText from "./IconText";
import StaffPage from "./StaffPage";
import TickIcon from "./TickIcon";

export const tickIconGallery: Example[] = [
  {
    name: "TickIcon",
    file: "app/(staff)/staff/_components/ui/TickIcon.tsx",
    variants: [
      {
        label: "Before words, in their colour",
        render: () => (
          <StaffPage as="div">
            <p>
              <IconText icon={<TickIcon />}>Copied</IconText>
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
