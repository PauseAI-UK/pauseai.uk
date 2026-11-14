// ResultBox in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { Button } from "@/components/ui/Button";
import ResultBox, { OPEN_UP_TO } from "./ResultBox";
import StaffPage from "../ui/StaffPage";
import { politiciansCopy } from "../politicians/copy";

export const resultBoxGallery: Example[] = [
  {
    name: "ResultBox",
    file: "app/(staff)/staff/_components/jobs/ResultBox.tsx",
    variants: [
      {
        label: "One line",
        render: () => (
          <StaffPage as="div">
            <ResultBox summary="An example result, in one line" />
          </StaffPage>
        ),
      },
      {
        label: "A few lines open under it, with buttons",
        render: () => (
          <StaffPage as="div">
            <ResultBox
              summary="An example result with detail"
              lines={2}
              actions={
                <>
                  <Button variant="primary" size="small" fit>
                    {politiciansCopy.politicianImports.apply}
                  </Button>
                  <Button variant="ghost" size="small" fit>
                    {politiciansCopy.politicianImports.discard}
                  </Button>
                </>
              }
            >
              <ul>
                <li>A line of detail</li>
                <li>Another line</li>
              </ul>
            </ResultBox>
          </StaffPage>
        ),
      },
      {
        label: "Many lines, folded",
        render: () => (
          <StaffPage as="div">
            <ResultBox summary="An example result with a lot of detail" lines={OPEN_UP_TO + 1}>
              <p>Folded detail</p>
            </ResultBox>
          </StaffPage>
        ),
      },
    ],
  },
];
