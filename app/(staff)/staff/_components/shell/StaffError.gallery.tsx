// StaffError in the component gallery (app/(tools)/gallery/), in the staff interface's shell.
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { StaffErrorExample } from "./StaffError.gallery.client";

export const staffErrorGallery: Example[] = [
  {
    name: "StaffError",
    file: "app/(staff)/staff/_components/shell/StaffError.tsx",
    variants: [{ label: "In place of a staff page that threw", render: () => <StaffErrorExample /> }],
  },
];
