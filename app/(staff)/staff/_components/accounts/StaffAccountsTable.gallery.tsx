// StaffAccountsTable in the component gallery (app/(tools)/gallery/), in the staff admin
// group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { AddStaffExample, StaffAccountsTableExample } from "./StaffAccountsTable.gallery.client";

export const staffAccountsTableGallery: Example[] = [
  {
    name: "StaffAccountsTable",
    file: "app/(staff)/staff/_components/accounts/StaffAccountsTable.tsx",
    variants: [
      {
        label: "Three accounts, each's permissions by name with Edit, Remove pressed twice, and what removing does",
        render: () => (
          <StaffPage as="div">
            <StaffAccountsTableExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "AddStaff",
    file: "app/(staff)/staff/_components/accounts/StaffAccountsTable.tsx",
    variants: [
      {
        label: "At the page's top right: press it for the box to add someone",
        render: () => (
          <StaffPage as="div">
            <AddStaffExample />
          </StaffPage>
        ),
      },
    ],
  },
];
