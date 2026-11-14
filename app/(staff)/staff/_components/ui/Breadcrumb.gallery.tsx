// Breadcrumb in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Breadcrumb from "./Breadcrumb";
import PageHead from "./PageHead";
import StaffPage from "./StaffPage";

export const breadcrumbGallery: Example[] = [
  {
    name: "Breadcrumb",
    file: "app/(staff)/staff/_components/ui/Breadcrumb.tsx",
    variants: [
      {
        label: "Above a letter's head: the navigation's page, the campaign it's of, then the letter itself",
        render: () => (
          <StaffPage as="div">
            <Breadcrumb
              steps={[
                { href: "/staff/campaigns", label: "Campaigns" },
                { href: "/staff/campaigns/example", label: "An example campaign" },
              ]}
              here="Letter"
            />
            <PageHead>Letter from Sam Sample to Jane Example MP</PageHead>
          </StaffPage>
        ),
      },
    ],
  },
];
