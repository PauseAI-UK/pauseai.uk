// AccountsNotice in the component gallery (app/(tools)/gallery/), in the staff admin
// group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import AccountsNotice from "./AccountsNotice";

export const accountsNoticeGallery: Example[] = [
  {
    name: "AccountsNotice",
    file: "app/(staff)/staff/_components/accounts/AccountsNotice.tsx",
    variants: [
      {
        label: "A change refused: the last admin",
        render: () => (
          <StaffPage as="div">
            <AccountsNotice notice="last-admin" />
          </StaffPage>
        ),
      },
    ],
  },
];
