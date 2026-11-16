// RunList in the component gallery (app/(tools)/gallery/), in the staff admin and accounts group (app/(tools)/gallery/_examples/staff-admin.tsx).
import type { Example } from "@/app/(tools)/gallery/_components/types";
import RunList from "./RunList";
import { exampleControlAiResult, exampleImportResult, exampleLumaResult, exampleRun } from "./RunList.examples";
import StaffPage from "../ui/StaffPage";

const AT = new Date("2026-11-03T12:00:00Z").getTime();
/** A Luma run `minutes` before noon. */
const luma = (id: number, minutes: number, run = {}, result = {}) =>
  exampleRun("import-luma", { ...exampleLumaResult, ...result }, { id, at: new Date(AT - minutes * 60_000), ...run });

export const runListGallery: Example[] = [
  {
    name: "RunList",
    file: "app/(staff)/staff/_components/jobs/RunList.tsx",
    variants: [
      {
        label:
          "A job that runs often: the newest opened, runs that found nothing in a row, one that stopped short, and routine runs further down folded",
        render: () => (
          <StaffPage as="div">
            <RunList
              none="None"
              runs={[
                luma(31, 0),
                luma(32, 5),
                luma(33, 10, { status: "unchanged" }),
                luma(34, 15, { status: "unchanged" }),
                luma(35, 20, {}, { stoppedBy: "time" }),
                ...Array.from({ length: 14 }, (_, i) => luma(40 + i, 25 + 5 * i)),
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
