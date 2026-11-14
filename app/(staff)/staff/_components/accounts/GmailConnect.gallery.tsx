// GmailConnect in the component gallery (app/(tools)/gallery/), in the staff admin
// group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { GmailConnect, GmailOutcome, SentToday } from "./GmailConnect";

export const gmailConnectGallery: Example[] = [
  {
    name: "GmailConnect",
    file: "app/(staff)/staff/_components/accounts/GmailConnect.tsx",
    variants: [
      {
        label: "What connecting means, said before going to Google",
        render: () => (
          <StaffPage as="div">
            <GmailConnect back="/staff/mailings/12" />
          </StaffPage>
        ),
      },
      {
        label: "The same for the letters inbox: what it does with supporters' letters, and its own limit",
        render: () => (
          <StaffPage as="div">
            <GmailConnect back="/staff/me" lettersInbox />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "SentToday",
    file: "app/(staff)/staff/_components/accounts/GmailConnect.tsx",
    variants: [
      {
        label: "An account's sends against today's limit",
        render: () => (
          <StaffPage as="div">
            <SentToday sent={120} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "GmailOutcome",
    file: "app/(staff)/staff/_components/accounts/GmailConnect.tsx",
    variants: (["connected", "other-account", "refused", "failed"] as const).map((outcome) => ({
      label: `Back from Google: ${outcome}`,
      render: () => (
        <StaffPage as="div">
          <GmailOutcome outcome={outcome} me="jo@pauseai.uk" />
        </StaffPage>
      ),
    })),
  },
];
