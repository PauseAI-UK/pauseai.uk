// PoliticianDetails in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { PoliticianDetailsExample } from "./PoliticianDetails.gallery.client";

export const politicianDetailsGallery: Example[] = [
  {
    name: "PoliticianDetails",
    file: "app/(staff)/staff/_components/politicians/PoliticianDetails.tsx",
    variants: [
      {
        label: "A signer the team added, staff's notes beside their correspondence",
        render: () => (
          <StaffPage as="div">
            <PoliticianDetailsExample />
          </StaffPage>
        ),
      },
      {
        label: "An MP from Airtable, not editable here",
        render: () => (
          <StaffPage as="div">
            <PoliticianDetailsExample fromAirtable />
          </StaffPage>
        ),
      },
      {
        label: "An MP whose address bounced, with the form to unblock it",
        render: () => (
          <StaffPage as="div">
            <PoliticianDetailsExample fromAirtable blocked />
          </StaffPage>
        ),
      },
      {
        label: "Without the supporters permission: letters without who wrote them",
        render: () => (
          <StaffPage as="div">
            <PoliticianDetailsExample fromAirtable senders={false} />
          </StaffPage>
        ),
      },
      {
        label: "Their aliases open at the foot, as their email's See aliases leads to",
        render: () => (
          <StaffPage as="div">
            <PoliticianDetailsExample fromAirtable aliases />
          </StaffPage>
        ),
      },
    ],
  },
];
