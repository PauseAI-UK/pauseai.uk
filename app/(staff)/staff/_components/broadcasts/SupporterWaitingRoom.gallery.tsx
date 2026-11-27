// SupporterWaitingRoom in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import SupporterWaitingRoom from "./SupporterWaitingRoom";
import { exampleLetIn } from "./WaitingRoom.examples";

export const supporterWaitingRoomGallery: Example[] = [
  {
    name: "SupporterWaitingRoom",
    file: "app/(staff)/staff/_components/broadcasts/SupporterWaitingRoom.tsx",
    variants: [
      {
        label: "A supporter's chat with the waiting room, on their page",
        render: () => (
          <StaffPage as="div">
            <SupporterWaitingRoom person={exampleLetIn} />
          </StaffPage>
        ),
      },
    ],
  },
];
