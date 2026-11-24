import type { Metadata } from "next";
import { latestRuns, runningJobs } from "@/lib/server/import-run-lists.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { now } from "@/lib/now";
import { ImportOverview } from "../../_components/jobs/ImportJob";
import Page from "../../_components/ui/Page";
import { jobsCopy } from "../../_components/jobs/copy";

export const metadata: Metadata = { title: jobsCopy.import.pageTitle };

/** Every import and check, a card each, with how its newest run ended; each card opens the job's page. */
export default async function ImportPage() {
  await requireStaff();
  const [newest, running] = await Promise.all([latestRuns(), runningJobs()]);
  return (
    <Page kind="board">
      <ImportOverview newest={newest} running={running} now={now()} />
    </Page>
  );
}
