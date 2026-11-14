// DevPreferences in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import DevPreferences from "./DevPreferences";

export const devPreferencesGallery: Example[] = [
  {
    name: "DevPreferences",
    file: "app/(staff)/staff/_components/supporters/DevPreferences.tsx",
    variants: [
      {
        label: "At the foot of a supporter's consents, in a fixture build only",
        render: () => (
          <DevPreferences
            emails={["jane.smith@example.com", "jane@example.org"]}
            permissions={[
              { address: "jane.smith@example.com", topic: "newsletter", way: "email", send: "yes" },
              { address: "jane.smith@example.com", topic: "events", way: "email", send: "yes" },
            ]}
            fixtures
          />
        ),
      },
    ],
  },
];
