// TextVersions in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { TextVersionsExample } from "./TextVersions.gallery.client";

export const textVersionsGallery: Example[] = [
  {
    name: "TextVersions",
    file: "app/(staff)/staff/_components/broadcasts/TextVersions.tsx",
    variants: [
      {
        label: "Two versions, two templates: press a tab for its version",
        render: () => (
          <StaffPage as="div">
            <TextVersionsExample templates={2} />
          </StaffPage>
        ),
      },
      {
        label: "Two versions that would be one template",
        render: () => (
          <StaffPage as="div">
            <TextVersionsExample templates={1} />
          </StaffPage>
        ),
      },
    ],
  },
];
