// SupporterBadges in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import SupporterBadges from "./SupporterBadges";
import { exampleMemberDetails, exampleSupporter } from "./SupportersTable.examples";

export const supporterBadgesGallery: Example[] = [
  {
    name: "SupporterBadges",
    file: "app/(staff)/staff/_components/supporters/SupporterBadges.tsx",
    variants: [
      {
        label: "A calendar contact who registered twice and wrote to their MP",
        render: () => (
          <StaffPage as="div">
            <SupporterBadges supporter={exampleSupporter} />
          </StaffPage>
        ),
      },
      {
        label: "A member",
        render: () => (
          <StaffPage as="div">
            <SupporterBadges supporter={exampleMemberDetails.summary} />
          </StaffPage>
        ),
      },
    ],
  },
];
