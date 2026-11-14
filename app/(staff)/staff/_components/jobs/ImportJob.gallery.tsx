// ImportJob in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import { ImportOverview } from "./ImportJob";
import {
  exampleControlAiStatementResult,
  exampleHeldImport,
  exampleImportResult,
  exampleFailedRun,
  exampleLumaResult,
  exampleGmailResult,
  exampleCivicrmResult,
  exampleRun,
} from "./RunList.examples";
import StaffPage from "../ui/StaffPage";
import { NIGHTLY } from "@/lib/import-runs";
import { ImportJobPageExample } from "./ImportJob.gallery.client";

export const importJobGallery: Example[] = [
  {
    name: "ImportOverview",
    file: "app/(staff)/staff/_components/jobs/ImportJob.tsx",
    variants: [
      {
        label: "Every job: one stopped short, one running, one held, one failed, one never run",
        render: () => (
          <StaffPage as="div">
            <ImportOverview
              running={[undefined, { startedBy: "jo@pauseai.uk", startedAt: new Date("2026-10-21T11:47:00Z") }]}
              newest={[
                exampleRun(
                  "import-luma",
                  { ...exampleLumaResult, stoppedBy: "time" },
                  { at: new Date("2026-10-21T11:17:00Z") },
                ),
                exampleRun("import-civicrm", exampleCivicrmResult, { at: new Date("2026-10-21T10:49:00Z") }),
                exampleRun("read-gmail", exampleGmailResult, { at: new Date("2026-10-21T11:20:00Z") }),
                undefined,
                { ...exampleHeldImport, at: new Date("2026-10-21T06:21:00Z") },
                exampleRun("import-scottish-parliament", exampleImportResult, {
                  at: new Date("2026-10-21T06:22:00Z"),
                }),
                undefined,
                undefined,
                exampleFailedRun("import-controlai", "No PDF linked", { at: new Date("2026-10-21T02:00:00Z") }),
                exampleRun("import-controlai-statement", exampleControlAiStatementResult, {
                  at: new Date("2026-10-21T06:26:00Z"),
                }),
                undefined,
              ]}
            />
          </StaffPage>
        ),
      },
    ],
  },
  {
    name: "ImportJobPage",
    file: "app/(staff)/staff/_components/jobs/ImportJob.tsx",
    variants: [
      {
        label: "The MP check's page: its button and every run, by day",
        render: () => (
          <StaffPage as="div">
            <ImportJobPageExample />
          </StaffPage>
        ),
      },
      {
        label: "A job that has never run",
        render: () => (
          <StaffPage as="div">
            <ImportJobPageExample never />
          </StaffPage>
        ),
      },
      {
        label: "A press still running: the earlier runs plain",
        render: () => (
          <StaffPage as="div">
            <ImportJobPageExample running="jo@pauseai.uk" />
          </StaffPage>
        ),
      },
      {
        label: "A run of its schedule going",
        render: () => (
          <StaffPage as="div">
            <ImportJobPageExample running={NIGHTLY} />
          </StaffPage>
        ),
      },
    ],
  },
];
