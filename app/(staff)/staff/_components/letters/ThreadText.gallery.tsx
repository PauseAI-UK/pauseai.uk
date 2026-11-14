// ThreadText in the component gallery (app/(tools)/gallery/), in the staff letters group (app/(tools)/gallery/_examples/staff-letters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ThreadText from "./ThreadText";
import StaffPage from "../ui/StaffPage";

export const threadTextGallery: Example[] = [
  {
    name: "ThreadText",
    file: "app/(staff)/staff/_components/letters/ThreadText.tsx",
    variants: [
      {
        label: "An email's plain text, with bold and a link",
        render: () => (
          <StaffPage as="div">
            <ThreadText text={"Dear Jane,\n\n*Our letter is out: https://example.org/letter*\n\nKind regards"} />
          </StaffPage>
        ),
      },
    ],
  },
];
