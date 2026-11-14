// AskKindIcon in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import AskKindIcon from "./AskKindIcon";

export const askKindIconGallery: Example[] = [
  {
    name: "AskKindIcon",
    file: "app/(staff)/staff/_components/campaigns/AskKindIcon.tsx",
    variants: [
      {
        label: "A letter and an event",
        render: () => (
          <>
            <AskKindIcon kind="letter" />
            <AskKindIcon kind="event" size={16} />
          </>
        ),
      },
    ],
  },
];
