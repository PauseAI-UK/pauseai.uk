// NavFold in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import NavFold from "./NavFold";
import StaffPage from "./StaffPage";

export const navFoldGallery: Example[] = [
  {
    name: "NavFold",
    file: "app/(staff)/staff/_components/ui/NavFold.tsx",
    variants: [
      {
        label: "On the sidebar's edge, at its foot: folds it to a rail of icons, and back",
        render: () => (
          <StaffPage as="div">
            {/* A box for it to sit on the right edge of, as the navigation is. */}
            <div
              style={{ position: "relative", width: "10rem", height: "2rem", borderRight: "1px solid var(--border)" }}
            >
              <NavFold />
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
