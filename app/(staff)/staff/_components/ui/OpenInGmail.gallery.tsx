// OpenInGmail in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import OpenInGmail from "./OpenInGmail";
import StaffPage from "./StaffPage";

export const openInGmailGallery: Example[] = [
  {
    name: "OpenInGmail",
    file: "app/(staff)/staff/_components/ui/OpenInGmail.tsx",
    variants: [
      {
        label: 'The link to a message in hello@\'s Gmail, its "i" opening what to do if Gmail shows another inbox',
        render: () => (
          <StaffPage as="div">
            <OpenInGmail
              href="https://mail.google.com/mail/?authuser=hello%40pauseai.uk#all/example"
              account="hello@pauseai.uk"
            />
          </StaffPage>
        ),
      },
    ],
  },
];
