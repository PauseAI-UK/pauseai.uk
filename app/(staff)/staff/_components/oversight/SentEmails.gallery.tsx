// SentEmails in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import SentEmails from "./SentEmails";
import { exampleSentEmails } from "./SentEmails.examples";
import StaffPage from "../ui/StaffPage";

export const sentEmailsGallery: Example[] = [
  {
    name: "SentEmails",
    file: "app/(staff)/staff/_components/oversight/SentEmails.tsx",
    variants: [
      {
        label: "A letter, one bounced, an imported mailing and a sign-in",
        render: () => (
          <StaffPage as="div">
            <SentEmails
              emails={exampleSentEmails}
              total={4}
              pages={1}
              page={1}
              pageSize={100}
              search={{ q: "", purpose: [], outcome: [], backend: [], link: [], sort: "", dir: "", page: "" }}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
