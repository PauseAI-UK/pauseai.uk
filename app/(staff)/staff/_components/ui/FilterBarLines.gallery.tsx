// FilterBarLines in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import FilterBarLines from "./FilterBarLines";
import StaffPage from "./StaffPage";

export const filterBarLinesGallery: Example[] = [
  {
    name: "FilterBarLines",
    file: "app/(staff)/staff/_components/ui/FilterBarLines.tsx",
    variants: [
      {
        label: "Unseen, around a filter bar's row: its last child takes its own line when they don't all fit",
        render: () => (
          <StaffPage as="div">
            <FilterBarLines className="">
              <span>Search</span>
              <span>Chips</span>
            </FilterBarLines>
          </StaffPage>
        ),
      },
    ],
  },
];
