// SubscriptionBadges in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import SubscriptionBadges from "./SubscriptionBadges";
import { exampleSupporterRows } from "./SupportersTable.examples";

export const subscriptionBadgesGallery: Example[] = [
  {
    name: "SubscriptionBadges",
    file: "app/(staff)/staff/_components/supporters/SubscriptionBadges.tsx",
    variants: [
      {
        label: "Agreed on their letter, unsubscribed from the calendar's emails",
        render: () => (
          <StaffPage as="div">
            <SubscriptionBadges permissions={exampleSupporterRows[0].permissions} />
          </StaffPage>
        ),
      },
      {
        label: "On the calendar; can't be sure of the updates",
        render: () => (
          <StaffPage as="div">
            <SubscriptionBadges permissions={exampleSupporterRows[1].permissions} />
          </StaffPage>
        ),
      },
    ],
  },
];
