// TwoVariants in the component gallery (app/(tools)/gallery/), in the staff broadcasts group (app/(tools)/gallery/_examples/staff-broadcasts.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import StaffPage from "../ui/StaffPage";
import TwoVariants from "./TwoVariants";

export const twoVariantsGallery: Example[] = [
  {
    name: "TwoVariants",
    file: "app/(staff)/staff/_components/broadcasts/TwoVariants.tsx",
    variants: [
      {
        label: "Beside a template's name: hover for who its conditional variant is for",
        render: () => (
          <StaffPage as="div">
            <p>
              <strong>We are flyering on Saturday.</strong>{" "}
              <TwoVariants who={broadcastsCopy.broadcastPages.conditions.registered("PauseAI London March")} />
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
