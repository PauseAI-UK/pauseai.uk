// TestTag in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "./StaffPage";
import TestTag from "./TestTag";

export const testTagGallery: Example[] = [
  {
    name: "TestTag",
    file: "app/(staff)/staff/_components/ui/TestTag.tsx",
    variants: [
      {
        label: "Beside a test politician's name, and nothing beside anyone else's",
        render: () => (
          <StaffPage as="div">
            <p>
              Testy McTestface MP <TestTag isTest />
            </p>
            <p>
              Polly Placeholder <TestTag isTest={false} />
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
