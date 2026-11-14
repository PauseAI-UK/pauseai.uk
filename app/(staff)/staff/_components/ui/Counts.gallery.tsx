// Counts in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import Counts, { countsOpening } from "./Counts";
import StaffPage from "./StaffPage";

export const countsGallery: Example[] = [
  {
    name: "Counts",
    file: "app/(staff)/staff/_components/ui/Counts.tsx",
    variants: [
      {
        label: "Each leading to its list, the failed one chosen; a 0 grey",
        render: () => (
          <StaffPage as="div">
            <Counts
              counts={[
                { key: "sent", n: 84, label: "sent", href: "#sent" },
                { key: "failed", n: 3, label: "failed", tone: "red", href: "#failed", current: true },
                { key: "replied", n: 0, label: "replied", href: "#replied" },
              ]}
            />
          </StaffPage>
        ),
      },
      {
        label: "Small, in a list's row, each opening its own tab; answers in green",
        render: () => (
          <StaffPage as="div">
            <Counts
              small
              counts={countsOpening("#mailing", [
                { key: "sent", n: 129, label: "sent" },
                { key: "failed", n: 2, label: "failed", tone: "red" },
                { key: "replied", n: 11, label: "replied" },
                { key: "answered", n: 14, label: "answers", tone: "green" },
              ])}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
