// WaitingRoom in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { WaitingRoomExample } from "./WaitingRoom.gallery.client";
import { WaitingChat } from "./WaitingRoom";
import { exampleDismissed, exampleHeld, exampleLetIn, exampleLetInByStaff, exampleLink } from "./WaitingRoom.examples";

export const waitingRoomGallery: Example[] = [
  {
    name: "WaitingRoom",
    file: "app/(staff)/staff/_components/broadcasts/WaitingRoom.tsx",
    variants: [
      {
        label: "Someone held, with why, and the buttons to let them in or dismiss them",
        render: () => (
          <StaffPage as="div">
            <WaitingRoomExample state="held" people={[exampleHeld]} link={exampleLink} />
          </StaffPage>
        ),
      },
      {
        label: "Let in by the check, and by staff while the link waits for them to write",
        render: () => (
          <StaffPage as="div">
            <WaitingRoomExample state="let-in" people={[exampleLetIn, exampleLetInByStaff]} link={exampleLink} />
          </StaffPage>
        ),
      },
      {
        label: "Dismissed",
        render: () => (
          <StaffPage as="div">
            <WaitingRoomExample state="dismissed" people={[exampleDismissed]} link={exampleLink} />
          </StaffPage>
        ),
      },
      {
        label: "No link set, and nobody held",
        render: () => (
          <StaffPage as="div">
            <WaitingRoomExample state="held" people={[]} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "WaitingChat",
    file: "app/(staff)/staff/_components/broadcasts/WaitingRoom.tsx",
    variants: [
      {
        label: "A chat with the waiting room: theirs at the left, ours at the right, and a voice note",
        render: () => (
          <StaffPage as="div">
            <WaitingChat person={exampleHeld} />
          </StaffPage>
        ),
      },
    ],
  },
];
