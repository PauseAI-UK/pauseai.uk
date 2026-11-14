"use client";

// ImportJob's examples, which log what's pressed (ImportJob.gallery.tsx).
import { ImportJobPage } from "./ImportJob";
import { exampleFailedRun, exampleImportResult, exampleRun } from "./RunList.examples";
import { Logged } from "@/app/(tools)/gallery/_components/wiring";

/** A job's page, its button and any held import's buttons logged: Parliament's import with three runs, while a run started by a staff member or its schedule is going, or the ControlAI import, never run. */
export function ImportJobPageExample({
  never = false,
  running,
}: {
  never?: boolean;
  /** Who started the run going now, if one is. */
  running?: string;
}) {
  return (
    <Logged>
      {(log) =>
        never ? (
          <ImportJobPage job="import-controlai" runs={[]} run={log("run")} decide={log("decide")} />
        ) : (
          <ImportJobPage
            job="import-parliament"
            running={running ? { startedBy: running, startedAt: new Date("2026-11-04T09:00:00Z") } : undefined}
            runs={[
              exampleRun("import-parliament", exampleImportResult, { id: 7, at: new Date("2026-11-03T06:21:00Z") }),
              exampleFailedRun("import-parliament", "Parliament answered 500", {
                id: 6,
                at: new Date("2026-11-02T06:21:00Z"),
              }),
              exampleRun("import-parliament", exampleImportResult, { id: 5, at: new Date("2026-11-01T06:21:00Z") }),
            ]}
            run={log("run")}
            decide={log("decide")}
          />
        )
      }
    </Logged>
  );
}
