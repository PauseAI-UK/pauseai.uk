// PoliticianWriting in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { AddressesBubbleExample, SalutationBubbleExample } from "./PoliticianWriting.gallery.client";

export const politicianWritingGallery: Example[] = [
  {
    name: "SalutationBubble",
    file: "app/(staff)/staff/_components/politicians/PoliticianWriting.tsx",
    variants: [
      { label: "A salutation, with its Change", render: () => <SalutationBubbleExample result={{ saved: true }} /> },
      {
        label: "One made from their name, which says so",
        render: () => <SalutationBubbleExample fromName result={{ saved: true }} />,
      },
    ],
  },
  {
    name: "AddressesBubble",
    file: "app/(staff)/staff/_components/politicians/PoliticianWriting.tsx",
    variants: [
      {
        label: "An MP's email, its bubble of their other addresses open",
        render: () => (
          <StaffPage as="div">
            <AddressesBubbleExample result={{ saved: true }} />
          </StaffPage>
        ),
      },
      {
        label: "A Lord with no email, to set one",
        render: () => (
          <StaffPage as="div">
            <AddressesBubbleExample lord result={{ saved: false, why: "shared" }} />
          </StaffPage>
        ),
      },
    ],
  },
];
