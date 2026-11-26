// The staff Press page in the component gallery (app/(tools)/gallery/), in the staff mailings
// and events group (app/(tools)/gallery/_examples/staff-mailings-events.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { AddPieceExample, PressFindsExample } from "./PressFinds.gallery.client";
import { EXAMPLE_PRESS_PAGE } from "./PressFinds.examples";

export const pressFindsGallery: Example[] = [
  {
    name: "PressFinds",
    file: "app/(staff)/staff/_components/press/PressFinds.tsx",
    variants: [
      {
        label: "Finds waiting, with the LLM's verdict or why the page couldn't be read; the coverage; Removed, folded",
        render: () => (
          <StaffPage as="div">
            <PressFindsExample page={EXAMPLE_PRESS_PAGE} />
          </StaffPage>
        ),
      },
      {
        label: "Nothing waiting or removed: the coverage alone",
        render: () => (
          <StaffPage as="div">
            <PressFindsExample page={{ ...EXAMPLE_PRESS_PAGE, waiting: [], notOurs: [], removed: [] }} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "AddPiece",
    file: "app/(staff)/staff/_components/press/PressFinds.tsx",
    variants: [
      {
        label: "At the top right of the page, opening the form for a piece staff found themselves",
        render: () => (
          <StaffPage as="div">
            <AddPieceExample />
          </StaffPage>
        ),
      },
    ],
  },
];
