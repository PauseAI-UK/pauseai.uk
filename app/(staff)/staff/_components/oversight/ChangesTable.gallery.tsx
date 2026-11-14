// ChangesTable in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { changesSearch } from "@/lib/staff-search";
import ChangesTable from "./ChangesTable";
import { exampleChanges } from "./ChangesTable.examples";
import StaffPage from "../ui/StaffPage";

export const changesTableGallery: Example[] = [
  {
    name: "ChangesTable",
    file: "app/(staff)/staff/_components/oversight/ChangesTable.tsx",
    variants: [
      {
        label: "One of each kind of entry, in words, and one of a kind it doesn't know",
        render: () => (
          <StaffPage as="div">
            <ChangesTable
              search={changesSearch({})}
              log={{ changes: exampleChanges, total: exampleChanges.length, pages: 1, pageSize: 100 }}
              page={1}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
