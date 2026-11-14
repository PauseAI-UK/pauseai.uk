// FilterBar in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import FilterBar from "./FilterBar";
import StaffPage from "./StaffPage";

// A filter that repeats, so it can leave out as well as find.
const EXAMPLE_NATIONS = [
  {
    name: "nation",
    label: "Nation",
    repeat: true,
    options: [
      { value: "england", label: "England" },
      { value: "scotland", label: "Scotland" },
      { value: "wales", label: "Wales" },
      { value: "ireland", label: "Northern Ireland" },
    ],
  },
];

// A blocked address list's filter, for the filter bar's examples.
const EXAMPLE_FILTERS = [
  {
    name: "kind",
    label: "Cause",
    options: [
      { value: "hard", label: "Bounced" },
      { value: "complaint", label: "Complained" },
    ],
  },
];

export const filterBarGallery: Example[] = [
  {
    name: "FilterBar",
    file: "app/(staff)/staff/_components/ui/FilterBar.tsx",
    variants: [
      {
        label: "Nothing on: the search and + Filter",
        render: () => (
          <StaffPage as="div">
            <FilterBar path="#" values={{}} search={{ name: "q", label: "Address" }} filters={EXAMPLE_FILTERS} />
          </StaffPage>
        ),
      },
      {
        label: "A search and a filter on, each removable, and Clear filters",
        render: () => (
          <StaffPage as="div">
            <FilterBar
              path="#"
              values={{ q: "example.org", kind: "hard" }}
              search={{ name: "q", label: "Address" }}
              filters={EXAMPLE_FILTERS}
            />
          </StaffPage>
        ),
      },
      {
        label: "A filter that repeats: one choice found, one left out, and + Filter cut in two with Except",
        render: () => (
          <StaffPage as="div">
            <FilterBar
              path="#"
              values={{ nation: ["scotland", "!wales"] }}
              search={{ name: "q", label: "Name" }}
              filters={EXAMPLE_NATIONS}
            />
          </StaffPage>
        ),
      },
      {
        label: "A filter that repeats, several choices: all it finds on one chip, all it leaves out on another",
        render: () => (
          <StaffPage as="div">
            <FilterBar
              path="#"
              values={{ nation: ["scotland", "england", "!wales", "!ireland"] }}
              search={{ name: "q", label: "Name" }}
              filters={EXAMPLE_NATIONS}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
