// SortHeading in the component gallery (app/(tools)/gallery/), in the staff interface: its kit (app/(tools)/gallery/_examples/staff-kit.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import SortHeading from "./SortHeading";
import StaffPage from "./StaffPage";
import Table from "@/components/ui/Table";

export const sortHeadingGallery: Example[] = [
  {
    name: "SortHeading",
    file: "app/(staff)/staff/_components/ui/SortHeading.tsx",
    variants: [
      {
        label: "Three headings: sorted by the first, ascending",
        render: () => (
          <StaffPage as="div">
            <Table>
              <thead>
                <tr>
                  <SortHeading sortKey="name" current={{ key: "name", dir: "asc" }} href="?sort=name&dir=desc">
                    Name
                  </SortHeading>
                  <SortHeading sortKey="party" current={{ key: "name", dir: "asc" }} href="?sort=party&dir=asc">
                    Party
                  </SortHeading>
                  <th>Not sortable</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Polly Placeholder</td>
                  <td>Labour</td>
                  <td>…</td>
                </tr>
              </tbody>
            </Table>
          </StaffPage>
        ),
      },
      {
        label:
          "In a box too narrow for them: a count's heading that breaks once, its arrow beside its last words, and one that breaks at every word",
        render: () => (
          <StaffPage as="div">
            <div style={{ width: "12rem" }}>
              <Table>
                <thead>
                  <tr>
                    <SortHeading
                      sortKey="from"
                      current={{ key: "from", dir: "desc" }}
                      href="?sort=from&dir=asc"
                      breakOnce
                    >
                      Emails from them
                    </SortHeading>
                    <SortHeading sortKey="first" current={{ key: "from", dir: "desc" }} href="?sort=first&dir=asc">
                      First time seen
                    </SortHeading>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>1</td>
                    <td>2</td>
                  </tr>
                </tbody>
              </Table>
            </div>
          </StaffPage>
        ),
      },
    ],
  },
];
