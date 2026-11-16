// SignupKindChoice in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { SignupKindChoiceExample } from "./SignupKindChoice.gallery.client";

export const signupKindChoiceGallery: Example[] = [
  {
    name: "SignupKindChoice",
    file: "app/(staff)/staff/_components/supporters/SignupKindChoice.tsx",
    variants: [
      {
        label: "Paper sign-ups picked",
        render: () => (
          <StaffPage as="div">
            <SignupKindChoiceExample />
          </StaffPage>
        ),
      },
    ],
  },
];
