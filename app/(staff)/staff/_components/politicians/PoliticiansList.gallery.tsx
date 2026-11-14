// PoliticiansList in the component gallery (app/(tools)/gallery/), in the staff politicians group
// (app/(tools)/gallery/_examples/staff-politicians.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import StaffPage from "../ui/StaffPage";
import { emptyPoliticiansSearch, examplePolitician, examplePoliticiansPage } from "./PoliticianTable.examples";
import { HouseTabs } from "./PoliticiansList";
import { ChoosingHeadExample, ChoosingListExample, PoliticiansListExample } from "./PoliticiansList.gallery.client";
import { exampleAsks } from "../asks/AsksList.examples";

export const politiciansListGallery: Example[] = [
  {
    name: "HouseTabs",
    file: "app/(staff)/staff/_components/politicians/PoliticiansList.tsx",
    variants: [
      {
        label: "The Lords chosen",
        render: () => (
          <StaffPage as="div">
            <HouseTabs search={{ ...emptyPoliticiansSearch, house: "lords" }} />
          </StaffPage>
        ),
      },
      {
        label: "Choosing who a mailing is for: the ticked tab, last, chosen",
        render: () => (
          <StaffPage as="div">
            <HouseTabs
              search={{ ...emptyPoliticiansSearch, mailing: "12", tab: "ticked" }}
              choosing={{ id: 12, title: "Edinburgh thank-you", blank: false, ticked: [1, 2, 3] }}
            />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ChoosingHead",
    file: "app/(staff)/staff/_components/politicians/PoliticiansList.tsx",
    variants: [
      {
        label: "Choosing who a new mailing is for: what to do, with Cancel, over the title",
        render: () => (
          <StaffPage as="div">
            <ChoosingHeadExample blank />
          </StaffPage>
        ),
      },
      {
        label: "Choosing who a draft goes to, named, with the way back to it",
        render: () => (
          <StaffPage as="div">
            <ChoosingHeadExample blank={false} />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "PoliticiansList",
    file: "app/(staff)/staff/_components/politicians/PoliticiansList.tsx",
    variants: [
      {
        label: "Choosing who a draft goes to: a tick box on each row and over them, Paste names, the bar at the foot",
        // The bar is fixed to the window's foot; a transform makes this example its window, so it sits at the example's foot.
        render: () => (
          <div style={{ transform: "translateZ(0)" }}>
            <StaffPage as="div">
              <ChoosingListExample />
            </StaffPage>
          </div>
        ),
      },
      {
        label: "After a paste: a row for each person the lines found, and why",
        render: () => (
          <div style={{ transform: "translateZ(0)" }}>
            <StaffPage as="div">
              <ChoosingListExample pasted />
            </StaffPage>
          </div>
        ),
      },
      {
        label: "A search's page of politicians, with more in other houses and out of office",
        render: () => (
          <StaffPage as="div">
            <PoliticiansListExample
              list={{ ...examplePoliticiansPage, total: 150, pages: 2, outOfOffice: 3, otherHouses: 2, tests: 1 }}
              search={{ ...emptyPoliticiansSearch, q: "pol" }}
              asks={exampleAsks}
            />
          </StaffPage>
        ),
      },
      {
        label: "A search that finds no one, with the nearest names",
        render: () => (
          <StaffPage as="div">
            <PoliticiansListExample
              list={{ ...examplePoliticiansPage, politicians: [], total: 0, closest: [examplePolitician] }}
              search={{ ...emptyPoliticiansSearch, q: "Polly Plaseholder" }}
              asks={exampleAsks}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
