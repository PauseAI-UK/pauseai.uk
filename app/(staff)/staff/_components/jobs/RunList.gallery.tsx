// RunList in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import RunList from "./RunList";
import { exampleControlAiResult, exampleImportResult, exampleLumaResult, exampleRun } from "./RunList.examples";
import StaffPage from "../ui/StaffPage";

export const runListGallery: Example[] = [
  {
    name: "RunList",
    file: "app/(staff)/staff/_components/jobs/RunList.tsx",
    variants: [
      {
        label:
          "A job that runs often: the day's table, the newest run green, a row for runs that found nothing and an amber one for a problem",
        render: () => (
          <StaffPage as="div">
            <RunList
              none="None"
              runs={[
                exampleRun("import-luma", exampleLumaResult, { id: 31 }),
                exampleRun("import-luma", exampleLumaResult, { id: 32 }),
                exampleRun("import-luma", exampleLumaResult, { id: 33, status: "unchanged" }),
                exampleRun("import-luma", exampleLumaResult, { id: 34, status: "unchanged" }),
                exampleRun("import-luma", { ...exampleLumaResult, stoppedBy: "time" }, { id: 35 }),
              ]}
            />
          </StaffPage>
        ),
      },
      {
        label: "A job's page: each day headed",
        render: () => (
          <StaffPage as="div">
            <RunList
              none="None"
              runs={[
                exampleRun("import-parliament", exampleImportResult, { id: 7, at: new Date("2026-11-03T06:21:00Z") }),
                exampleRun("import-controlai", exampleControlAiResult, {
                  id: 8,
                  at: new Date("2026-11-02T02:00:00Z"),
                }),
                exampleRun("import-senedd", exampleImportResult, {
                  id: 6,
                  at: new Date("2026-11-02T00:30:00Z"),
                  status: "discarded",
                  decidedBy: "jo@pauseai.uk",
                }),
              ]}
            />
          </StaffPage>
        ),
      },
      {
        label: "None",
        render: () => (
          <StaffPage as="div">
            <RunList runs={[]} none="An example line saying there are none." />
          </StaffPage>
        ),
      },
    ],
  },
];
