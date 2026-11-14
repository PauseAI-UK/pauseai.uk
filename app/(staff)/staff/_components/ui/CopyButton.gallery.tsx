// CopyButton in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import CopyButton from "./CopyButton";
import StaffPage from "./StaffPage";

export const copyButtonGallery: Example[] = [
  {
    name: "CopyButton",
    file: "app/(staff)/staff/_components/ui/CopyButton.tsx",
    variants: [
      {
        label: "Copies its text, then says so, with a note in a bubble",
        render: () => (
          <StaffPage as="div">
            <CopyButton
              text="rfc822msgid:4f1c@pauseai.uk"
              label="Copy"
              copied="Copied!"
              note="Paste it in"
              close="Close"
            />
          </StaffPage>
        ),
      },
    ],
  },
];
