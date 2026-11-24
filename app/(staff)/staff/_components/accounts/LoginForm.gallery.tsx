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
        label: "Back from Google: it failed, and an account that isn't pauseai.uk's",
        render: () => (
          <StaffPage as="div">
            <LoginCard title={accountsCopy.login.title}>
              <LoginForm failed="1" other="1" />
            </LoginCard>
          </StaffPage>
        ),
      },
    ],
  },
];
