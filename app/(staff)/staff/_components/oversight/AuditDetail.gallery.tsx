// AuditDetail in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import AuditDetail from "./AuditDetail";
import { exampleChanges } from "./ChangesTable.examples";
import StaffPage from "../ui/StaffPage";

export const auditDetailGallery: Example[] = [
  {
    name: "AuditDetail",
    file: "app/(staff)/staff/_components/oversight/AuditDetail.tsx",
    variants: [
      {
        label: "An MP's status set, in words, linked to their page and the campaign's",
        render: () => (
          <StaffPage as="div">
            <AuditDetail change={exampleChanges[0]} />
          </StaffPage>
        ),
      },
    ],
  },
];
