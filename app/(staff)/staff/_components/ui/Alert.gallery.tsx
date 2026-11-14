// Alert in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Alert from "./Alert";
import StaffPage from "./StaffPage";

export const alertGallery: Example[] = [
  {
    name: "Alert",
    file: "app/(staff)/staff/_components/ui/Alert.tsx",
    variants: [
      {
        label: "An error, and something waiting",
        render: () => (
          <StaffPage as="div">
            <Alert>An example of something that went wrong.</Alert>
            <Alert tone="amber">An example of something waiting for a person.</Alert>
          </StaffPage>
        ),
      },
    ],
  },
];
