// NavIcon in the component gallery (app/(tools)/gallery/), in the staff kit
// group (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import NavIcon from "./NavIcon";

export const navIconGallery: Example[] = [
  {
    name: "NavIcon",
    file: "app/(staff)/staff/_components/shell/NavIcon.tsx",
    variants: [
      {
        label: "Each page's icon, and Log out's",
        render: () => (
          <StaffPage as="div">
            <p>
              {(
                [
                  "home",
                  "supporters",
                  "campaigns",
                  "sentEmails",
                  "supporterEmails",
                  "politicians",
                  "asks",
                  "mailings",
                  "emails",
                  "mpEmails",
                  "import",
                  "accounts",
                  "changes",
                  "logout",
                ] as const
              ).map((id) => (
                <NavIcon key={id} id={id} />
              ))}
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
