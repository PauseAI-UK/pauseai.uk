// LetterLink in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import LetterLink from "./LetterLink";
import StaffPage from "../ui/StaffPage";

export const letterLinkGallery: Example[] = [
  {
    name: "LetterLink",
    file: "app/(staff)/staff/_components/letters/LetterLink.tsx",
    variants: [
      {
        label: "A letter, by whom it was to",
        render: () => (
          <StaffPage as="div">
            <LetterLink letter={{ id: 17, to: "Bouncy McTestface MP" }} linked />
          </StaffPage>
        ),
      },
      {
        label: "Not linked, for staff without the supporters permission",
        render: () => (
          <StaffPage as="div">
            <LetterLink letter={{ id: 17, to: "Bouncy McTestface MP" }} linked={false} />
          </StaffPage>
        ),
      },
    ],
  },
];
