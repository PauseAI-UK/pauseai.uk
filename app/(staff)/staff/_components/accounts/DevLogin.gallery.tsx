// DevLogin in the component gallery (app/(tools)/gallery/), in the staff admin
// group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { accountsCopy } from "./copy";
import DevLogin from "./DevLogin";
import LoginCard from "./LoginCard";
import LoginForm from "./LoginForm";

export const devLoginGallery: Example[] = [
  {
    name: "DevLogin",
    file: "app/(staff)/staff/_components/accounts/DevLogin.tsx",
    variants: [
      {
        label: "Under the login card, in a fixture build only",
        render: () => (
          <StaffPage as="div">
            <LoginCard title={accountsCopy.login.title}>
              <LoginForm />
            </LoginCard>
            <DevLogin
              accounts={[
                { email: "admin@pauseai.uk", description: accountsCopy.devLogin.permissions("Admin") },
                { email: "jo@pauseai.uk", description: accountsCopy.devLogin.permissions("Supporters") },
                { email: "samuel.whitlock@pauseai.uk", description: accountsCopy.devLogin.noPermissions },
                { email: "nobody@pauseai.uk", description: accountsCopy.devLogin.noAccount },
              ]}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
