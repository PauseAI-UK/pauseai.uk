// LoginForm in the component gallery (app/(tools)/gallery/), in the staff admin
// group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { accountsCopy } from "./copy";
import LoginCard from "./LoginCard";
import LoginForm from "./LoginForm";

export const loginFormGallery: Example[] = [
  {
    name: "LoginForm",
    file: "app/(staff)/staff/_components/accounts/LoginForm.tsx",
    variants: [
      {
        label: "After a failed link, and one opened in another browser",
        render: () => (
          <StaffPage as="div">
            <LoginCard title={accountsCopy.login.title}>
              <LoginForm failed="1" elsewhere="1" />
            </LoginCard>
          </StaffPage>
        ),
      },
      {
        label: "The link sent",
        render: () => (
          <StaffPage as="div">
            <LoginCard title={accountsCopy.login.title}>
              <LoginForm sent="1" />
            </LoginCard>
          </StaffPage>
        ),
      },
    ],
  },
];
