// AskForm in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { AskFormExample } from "./AskForm.gallery.client";

export const askFormGallery: Example[] = [
  {
    name: "AskForm",
    file: "app/(staff)/staff/_components/campaigns/AskForm.tsx",
    variants: [
      {
        label: "A new ask",
        render: () => (
          <StaffPage as="div">
            <AskFormExample ask="new" />
          </StaffPage>
        ),
      },
      {
        label: "One staff added, just saved, which nobody has answered: Delete pressed twice",
        render: () => (
          <StaffPage as="div">
            <AskFormExample ask="added" notice="saved" />
          </StaffPage>
        ),
      },
      {
        label: "One politicians have answered: its kind fixed, and it can't be deleted",
        render: () => (
          <StaffPage as="div">
            <AskFormExample ask="answered" notice="in-use" />
          </StaffPage>
        ),
      },
      {
        label: "One the site's code names, which can be changed but not deleted",
        render: () => (
          <StaffPage as="div">
            <AskFormExample ask="named" />
          </StaffPage>
        ),
      },
    ],
  },
];
