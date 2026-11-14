// DownloadMenu in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import DownloadMenu from "./DownloadMenu";
import StaffPage from "./StaffPage";

export const downloadMenuGallery: Example[] = [
  {
    name: "DownloadMenu",
    file: "app/(staff)/staff/_components/ui/DownloadMenu.tsx",
    variants: [
      {
        label: "Download, opening the formats of every row: CSV and JSON",
        render: () => (
          <StaffPage as="div">
            <DownloadMenu download={(format) => `#${format}`} />
          </StaffPage>
        ),
      },
    ],
  },
];
