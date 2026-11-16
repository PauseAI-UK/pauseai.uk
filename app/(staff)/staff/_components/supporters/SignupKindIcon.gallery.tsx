// SignupKindIcon in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import SignupKindIcon from "./SignupKindIcon";

export const signupKindIconGallery: Example[] = [
  {
    name: "SignupKindIcon",
    file: "app/(staff)/staff/_components/supporters/SignupKindIcon.tsx",
    variants: [
      {
        label: "Paper sign-ups, then a WhatsApp group",
        render: () => (
          <StaffPage as="div">
            <SignupKindIcon kind="paper" /> <SignupKindIcon kind="whatsapp" />
          </StaffPage>
        ),
      },
    ],
  },
];
