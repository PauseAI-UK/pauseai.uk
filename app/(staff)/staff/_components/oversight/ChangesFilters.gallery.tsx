// ChangesFilters in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { ChangesFiltersExample } from "./ChangesFilters.gallery.client";

export const changesFiltersGallery: Example[] = [
  {
    name: "ChangesFilters",
    file: "app/(staff)/staff/_components/oversight/ChangesFilters.tsx",
    variants: [
      {
        label: "Several of who chosen, one of what left out, and how recent",
        render: () => <ChangesFiltersExample />,
      },
    ],
  },
];
