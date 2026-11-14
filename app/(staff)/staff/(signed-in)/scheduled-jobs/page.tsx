import type { Metadata } from "next";
import { IMPORT_JOBS } from "@/lib/import-runs";
import { latestRun, runningNow } from "@/lib/server/import-runs.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { ImportOverview } from "../../_components/jobs/ImportJob";
import Page from "../../_components/ui/Page";
import { jobsCopy } from "../../_components/jobs/copy";

export const metadata: Metadata = { title: jobsCopy.import.pageTitle };

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
