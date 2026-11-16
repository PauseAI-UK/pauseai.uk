// RunBox in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import RunBox, { RunState } from "./RunBox";
import { exampleImportResult, exampleFailedRun, exampleLumaResult, exampleRun } from "./RunList.examples";
import StaffPage from "../ui/StaffPage";
import { jobsCopy } from "./copy";

const status = jobsCopy.runs.status;

export const runBoxGallery: Example[] = [
  {
    name: "RunBox",
    file: "app/(staff)/staff/_components/jobs/RunBox.tsx",
    variants: [
      {
        label: "A row with detail, opened; one with a problem; one that failed",
        render: () => (
          <StaffPage as="div">
            <RunBox
              run={exampleRun("import-parliament", exampleImportResult, {
                status: "applied",
                decidedBy: "jo@pauseai.uk",
              })}
              summary="an example summary"
              open
            >
              <p>Detail</p>
            </RunBox>
            <RunBox
              run={exampleRun(
                "import-luma",
                { ...exampleLumaResult, stoppedBy: "time" },
                { id: 2, problems: [{ what: "An example problem", error: "its error" }], startedBy: "jo@pauseai.uk" },
              )}
              summary="an example summary"
            />
            <RunBox run={exampleFailedRun("import-parliament", "An example error", { id: 5 })} summary={null} />
          </StaffPage>
        ),
      },
      {
        label: "On one line, as a job's card has its newest",
        render: () => (
          <StaffPage as="div">
            <RunBox run={exampleRun("import-luma", exampleLumaResult)} summary="an example summary" variant="line" />
            <RunBox
              run={exampleFailedRun("import-parliament", "An example error", { id: 5 })}
              summary={null}
              variant="line"
            />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "RunState",
    file: "app/(staff)/staff/_components/jobs/RunBox.tsx",
    variants: [
      {
        label: "Each colour: done, held, failed, running, and none",
        render: () => (
          <StaffPage as="div">
            <p>
              <RunState tone="green">{status.ok}</RunState>
            </p>
            <p>
              <RunState tone="amber">{status.held}</RunState>
            </p>
            <p>
              <RunState tone="red">{status.failed}</RunState>
            </p>
            <p>
              <RunState tone="blue">{status.running}</RunState>
            </p>
            <p>
              <RunState tone={undefined}>{status.discarded}</RunState>
            </p>
          </StaffPage>
        ),
      },
    ],
  },
];
