// StaffNav in the component gallery (app/(tools)/gallery/), in the staff kit
// group (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import StaffNav, { type StaffPage as StaffPageName } from "./StaffNav";

// Every page the navigation can mark as current, so a new one is a type error until it's here.
const PAGES: Record<StaffPageName, true> = {
  home: true,
  me: true,
  supporters: true,
  signupUpload: true,
  campaigns: true,
  broadcasts: true,
  sentEmails: true,
  events: true,
  supporterEmails: true,
  politicians: true,
  asks: true,
  mailings: true,
  emails: true,
  mpEmails: true,
  import: true,
  changes: true,
  errors: true,
  accounts: true,
};

export const staffNavGallery: Example[] = [
  {
    name: "StaffNav",
    file: "app/(staff)/staff/_components/shell/StaffNav.tsx",
    variants: [
      {
        label: "On the login page: the title alone",
        render: () => (
          <StaffPage as="div">
            <StaffNav />
          </StaffPage>
        ),
      },
      {
        label: "For someone without permissions: the pages any account opens",
        render: () => (
          <StaffPage as="div">
            <StaffNav email="jo@pauseai.uk" permissions={[]} current="politicians" />
          </StaffPage>
        ),
      },
      {
        label: "With the supporters permission",
        render: () => (
          <StaffPage as="div">
            <StaffNav email="jo@pauseai.uk" permissions={["supporters"]} current="campaigns" />
          </StaffPage>
        ),
      },
      {
        label: "With pages they first saw in the last few days marked new",
        render: () => (
          <StaffPage as="div">
            <StaffNav email="jo@pauseai.uk" permissions={["supporters", "admin"]} fresh={["campaigns", "sentEmails"]} />
          </StaffPage>
        ),
      },
      {
        label: "For an admin, on each page",
        render: () => (
          <StaffPage as="div">
            <div style={{ display: "grid", gap: 24 }}>
              {(Object.keys(PAGES) as StaffPageName[]).map((current) => (
                <StaffNav key={current} email="jo@pauseai.uk" permissions={["admin", "supporters"]} current={current} />
              ))}
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
