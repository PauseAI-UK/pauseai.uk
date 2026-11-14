// PoliticianFilters in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import PoliticianFilters from "./PoliticianFilters";
import { emptyPoliticiansSearch } from "./PoliticianTable.examples";
import { exampleAsks } from "../campaigns/AsksList.examples";

/** The parties a filter of politicians picks from. */
const parties = ["Conservative", "Green", "Labour", "Liberal Democrat"];

export const politicianFiltersGallery: Example[] = [
  {
    name: "PoliticianFilters",
    file: "app/(staff)/staff/_components/politicians/PoliticianFilters.tsx",
    variants: [
      {
        label: "Empty, filled in, and an ask with no answer chosen",
        render: () => (
          <StaffPage as="div">
            <PoliticianFilters search={emptyPoliticiansSearch} asks={exampleAsks} parties={parties} />
            <PoliticianFilters
              search={{
                ...emptyPoliticiansSearch,
                q: "example",
                house: "lords",
                status: "in_office",
                party: ["Labour", "Green"],
                flag: ["important"],
                nation: ["wales"],
                email: ["blocked"],
                ask: "edinburgh-conference-2026",
                answer: ["declined", "none"],
              }}
              asks={exampleAsks}
              parties={parties}
            />
            <PoliticianFilters
              search={{ ...emptyPoliticiansSearch, ask: "edinburgh-conference-2026" }}
              asks={exampleAsks}
              parties={parties}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
