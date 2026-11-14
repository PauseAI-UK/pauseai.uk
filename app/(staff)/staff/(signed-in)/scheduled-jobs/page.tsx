import type { Metadata } from "next";
import { staffCopy } from "@/lib/content/staff-interface";
import { IMPORT_JOBS } from "@/lib/import-runs";
import { latestRun, runningNow } from "@/lib/server/import-runs";
import { requireStaff } from "@/lib/server/staff-auth";
import { ImportOverview } from "../../_components/ImportJob";
import Page from "../../_components/ui/Page";

export const metadata: Metadata = { title: staffCopy.import.pageTitle };

/** Every import and check, a card each, with how its newest run ended; each card opens the job's page. */
export default async function ImportPage() {
  await requireStaff();
  const [newest, running] = await Promise.all([
    Promise.all(IMPORT_JOBS.map((job) => latestRun(job))),
    Promise.all(IMPORT_JOBS.map((job) => runningNow(job))),
  ]);
  return (
    <Page kind="board">
      <ImportOverview newest={newest} running={running} />
    </Page>
  );
}
