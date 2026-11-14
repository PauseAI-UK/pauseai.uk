// ErasedNotice in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import ErasedNotice from "./ErasedNotice";

export const erasedNoticeGallery: Example[] = [
  {
    name: "ErasedNotice",
    file: "app/(staff)/staff/_components/erasure/ErasedNotice.tsx",
    variants: [
      {
        label: "Done",
        render: () => (
          <StaffPage as="div">
            <ErasedNotice erased="1" />
          </StaffPage>
        ),
      },
      {
        label: "Erased, but something couldn't be cleared",
        render: () => (
          <StaffPage as="div">
            <ErasedNotice erased="partly" why="mail,oneOffs" />
          </StaffPage>
        ),
      },
    ],
  },
];
