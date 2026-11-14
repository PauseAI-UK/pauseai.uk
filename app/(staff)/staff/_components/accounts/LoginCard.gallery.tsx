// LoginCard in the component gallery (app/(tools)/gallery/), in the staff admin
// group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { accountsCopy } from "./copy";
import LoginCard from "./LoginCard";
import LoginForm from "./LoginForm";

export const loginCardGallery: Example[] = [
  {
    name: "LoginCard",
    file: "app/(staff)/staff/_components/accounts/LoginCard.tsx",
    variants: [
      {
        label: "Around the login form",
        render: () => (
          <StaffPage as="div">
            <LoginCard title={accountsCopy.login.title}>
              <LoginForm />
            </LoginCard>
          </StaffPage>
        ),
      },
    ],
  },
];
