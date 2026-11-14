// RunBox in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import RunBox from "./RunBox";
import { exampleImportResult, exampleFailedRun, exampleLumaResult, exampleRun } from "./RunList.examples";
import StaffPage from "../ui/StaffPage";

export const runBoxGallery: Example[] = [
  {
    name: "RunBox",
    file: "app/(staff)/staff/_components/jobs/RunBox.tsx",
    variants: [
      {
        label: "A run, with detail",
        render: () => (
          <StaffPage as="div">
            <RunBox
              run={exampleRun("import-parliament", exampleImportResult, { status: "applied" })}
              summary="an example summary"
              lines={1}
            >
              <p>Detail</p>
            </RunBox>
          </StaffPage>
        ),
      },
      {
        label: "A run that stopped before it finished, and one that failed",
        render: () => (
          <StaffPage as="div">
            <RunBox
              run={exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "time" })}
              summary="an example summary"
            />
            <RunBox run={exampleFailedRun("import-parliament", "An example error", { id: 5 })} summary={null} />
          </StaffPage>
        ),
      },
    ],
  },
];
