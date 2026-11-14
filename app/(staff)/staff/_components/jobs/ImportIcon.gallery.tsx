// ImportIcon in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ImportIcon from "./ImportIcon";
import StaffPage from "../ui/StaffPage";

export const importIconGallery: Example[] = [
  {
    name: "ImportIcon",
    file: "app/(staff)/staff/_components/jobs/ImportIcon.tsx",
    variants: [
      {
        label: "Each source",
        render: () => (
          <StaffPage as="div">
            <div style={{ display: "flex", gap: "var(--space-3)" }}>
              {(["luma", "civicrm", "gmail", "parliament", "controlai", "database"] as const).map((source) => (
                <ImportIcon key={source} source={source} />
              ))}
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
