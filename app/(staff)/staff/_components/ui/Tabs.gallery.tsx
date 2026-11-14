// Tabs in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "./StaffPage";
import Tabs from "./Tabs";

export const tabsGallery: Example[] = [
  {
    name: "Tabs",
    file: "app/(staff)/staff/_components/ui/Tabs.tsx",
    variants: [
      {
        label: "A list's houses, Lords chosen",
        render: () => (
          <StaffPage as="div">
            <Tabs
              label="House"
              current="lords"
              tabs={[
                { key: "", label: "All houses", href: "#" },
                { key: "commons", label: "House of Commons", href: "#" },
                { key: "lords", label: "House of Lords", href: "#" },
                { key: "senedd", label: "Senedd", href: "#" },
              ]}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
