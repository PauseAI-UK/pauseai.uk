// SupportersTable in the component gallery (app/(tools)/gallery/), in the staff supporters group
// (app/(tools)/gallery/_examples/staff-supporters.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { supportersSearch } from "@/lib/staff-search";
import StaffPage from "../ui/StaffPage";
import SupportersTable from "./SupportersTable";
import { exampleSupporterRows } from "./SupportersTable.examples";

export const supportersTableGallery: Example[] = [
  {
    name: "SupportersTable",
    file: "app/(staff)/staff/_components/supporters/SupportersTable.tsx",
    variants: [
      {
        label: "Three supporters, one page of three",
        render: () => (
          <StaffPage as="div">
            <SupportersTable
              search={supportersSearch({ page: "2" })}
              page={{
                supporters: exampleSupporterRows,
                total: 120,
                pages: 3,
              }}
            />
          </StaffPage>
        ),
      },
      {
        label: "Nobody found",
        render: () => (
          <StaffPage as="div">
            <SupportersTable search={supportersSearch({})} page={{ supporters: [], total: 0, pages: 1 }} />
          </StaffPage>
        ),
      },
    ],
  },
];
