// PartBox in the component gallery (app/(tools)/gallery/), in the staff mailings and events
// group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import PartBox, { PartMark } from "./PartBox";
import { ClosablePartExample } from "./PartBox.gallery.client";

export const partBoxGallery: Example[] = [
  {
    name: "PartBox",
    file: "app/(staff)/staff/_components/mailings/PartBox.tsx",
    variants: [
      {
        label: "Only for some, green",
        render: () => (
          <StaffPage as="div">
            <PartBox label="Only for those who signed the Frontier AI letter">
              <p>Thank you again for signing our open letter to the Prime Minister.</p>
            </PartBox>
          </StaffPage>
        ),
      },
      {
        label: "For all but some, grey",
        render: () => (
          <StaffPage as="div">
            <PartBox label="Except those who signed the Frontier AI letter" except>
              <p>Would you sign our open letter to the Prime Minister?</p>
            </PartBox>
          </StaffPage>
        ),
      },
      {
        label: "With the × that makes it for everyone",
        render: () => (
          <StaffPage as="div">
            <ClosablePartExample />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "PartMark",
    file: "app/(staff)/staff/_components/mailings/PartBox.tsx",
    variants: [
      {
        label: "A small mark in a part's look, after a name: hover for who the part is for",
        render: () => (
          <StaffPage as="div">
            <p>
              Thank you for marching{" "}
              <PartMark
                icon={<span aria-hidden="true">●</span>}
                title="Only for those who signed the Frontier AI letter"
              >
                Has a part
              </PartMark>
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
