// SavedFilters in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { SavedFilterExample, SavedFilterGoneExample } from "./SavedFilters.gallery.client";

export const savedFiltersGallery: Example[] = [
  {
    name: "SavedFilters",
    file: "app/(staff)/staff/_components/ui/SavedFilters.tsx",
    variants: [
      {
        label: "Nothing on: the chip alone",
        render: () => <SavedFilterExample state="none" />,
      },
      {
        label: "A filter on: Save is its second half",
        render: () => <SavedFilterExample state="unsaved" />,
      },
      {
        label: "Loaded, unchanged: named for the filter, its bookmark filled",
        render: () => <SavedFilterExample state="loaded" />,
      },
      {
        label: "Loaded and edited, with a long name: cut short, 'edited' whole, Save a menu",
        render: () => <SavedFilterExample state="edited" />,
      },
    ],
  },
  {
    name: "SavedFilterGone",
    file: "app/(staff)/staff/_components/ui/SavedFilters.tsx",
    variants: [
      {
        label: "A saved filter naming something that has gone",
        render: () => <SavedFilterGoneExample />,
      },
    ],
  },
];
