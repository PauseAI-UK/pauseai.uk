// RunTable in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import RunTable from "./RunTable";
import {
  exampleFailedRun,
  exampleLumaResult,
  exampleGmailResult,
  exampleCivicrmResult,
  exampleRun,
} from "./RunList.examples";
import StaffPage from "../ui/StaffPage";

export const runTableGallery: Example[] = [
  {
    name: "RunTable",
    file: "app/(staff)/staff/_components/jobs/RunTable.tsx",
    variants: [
      {
        label: "Luma: a run that stopped short, then a stretch that found nothing",
        render: () => (
          <StaffPage as="div">
            <RunTable
              header
              entries={[
                { shape: "rows", runs: [exampleRun("import-luma", exampleLumaResult, { id: 22 })] },
                {
                  shape: "run",
                  tone: "amber",
                  runs: [exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "time" }, { id: 23 })],
                },
                {
                  shape: "quiet",
                  runs: [
                    exampleRun("import-luma", exampleLumaResult, { id: 24, status: "unchanged" }),
                    exampleRun("import-luma", exampleLumaResult, {
                      id: 25,
                      at: new Date("2026-10-15T01:55:00Z"),
                      status: "unchanged",
                    }),
                  ],
                },
              ]}
            />
          </StaffPage>
        ),
      },
      {
        label: "Gmail: a read that found something, and one that failed",
        render: () => (
          <StaffPage as="div">
            <RunTable
              header
              entries={[
                { shape: "rows", runs: [exampleRun("read-gmail", exampleGmailResult, { id: 26 })] },
                { shape: "run", tone: "red", runs: [exampleFailedRun("read-gmail", "Database down", { id: 27 })] },
              ]}
            />
          </StaffPage>
        ),
      },
      {
        label: "A job without counts: CiviCRM's, hourly, its run's words spanning the table",
        render: () => (
          <StaffPage as="div">
            <RunTable
              header
              entries={[{ shape: "run", runs: [exampleRun("import-civicrm", exampleCivicrmResult, { id: 28 })] }]}
            />
          </StaffPage>
        ),
      },
    ],
  },
];
