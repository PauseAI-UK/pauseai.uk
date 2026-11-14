// SupporterDetails in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import SupporterDetails from "./SupporterDetails";
import { exampleMemberDetails, exampleSupporter, exampleSupporterDetails } from "./SupportersTable.examples";

export const supporterDetailsGallery: Example[] = [
  {
    name: "SupporterDetails",
    file: "app/(staff)/staff/_components/supporters/SupporterDetails.tsx",
    variants: [
      {
        label: "A supporter known from Luma and a letter, opted out on one address",
        render: () => (
          <StaffPage as="div">
            <SupporterDetails supporter={exampleSupporterDetails} />
          </StaffPage>
        ),
      },
      {
        label: "A member who opted out of the updates on joining, then asked for them on re-joining",
        render: () => (
          <StaffPage as="div">
            <SupporterDetails supporter={exampleMemberDetails} />
          </StaffPage>
        ),
      },
      {
        label: "A supporter with no name, nothing given and no activity",
        render: () => (
          <StaffPage as="div">
            <SupporterDetails
              supporter={{
                mp: null,
                letters: [],
                summary: {
                  ...exampleSupporter,
                  name: null,
                  emails: ["x@example.com"],
                  events: 0,
                  letters: 0,
                  lumaContact: false,
                },
                identities: [{ source: "luma", email: "x@example.com", name: "", seenAt: null }],
                contacts: [],
                activity: [],
                permissions: [],
              }}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
