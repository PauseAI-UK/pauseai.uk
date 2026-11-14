// ExternalLink in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import ExternalLink from "./ExternalLink";
import StaffPage from "./StaffPage";

export const externalLinkGallery: Example[] = [
  {
    name: "ExternalLink",
    file: "app/(staff)/staff/_components/ui/ExternalLink.tsx",
    variants: [
      {
        label: "A link out of the site, with its arrow: in a new tab, as a screen reader hears",
        render: () => (
          <StaffPage as="div">
            <p>
              See <ExternalLink href="https://example.org/">the letter</ExternalLink> for the wording.
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
