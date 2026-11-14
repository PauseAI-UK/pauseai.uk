// Logged in the component gallery (app/(tools)/gallery/), in the staff interface: admin and accounts (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { DotParts, LoggedJson } from "./Logged";
import StaffPage from "./StaffPage";

export const loggedGallery: Example[] = [
  {
    name: "DotParts",
    file: "app/(staff)/staff/_components/ui/Logged.tsx",
    variants: [
      {
        label: "Parts of a line, between middle dots",
        render: () => (
          <StaffPage as="div">
            <DotParts>{["Bounced", "Type HardBounce", "Address jo.mp@parliament.uk"]}</DotParts>
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "LoggedJson",
    file: "app/(staff)/staff/_components/ui/Logged.tsx",
    variants: [
      {
        label: "The {} button, which opens what was logged as JSON",
        render: () => (
          <StaffPage as="div">
            <LoggedJson id="gallery-logged-json" details={{ type: "HardBounce", description: "No such address" }} />
          </StaffPage>
        ),
      },
    ],
  },
];
