import type { Metadata } from "next";
import { found } from "@/lib/found";
import { jobBySlug } from "@/lib/import-runs";
import { listRuns, runningNow } from "@/lib/server/import-runs.server";
import { requireStaff } from "@/lib/accounts/auth.server";
import { decideImport, runJobNow } from "../../../_components/jobs/actions";
import { ImportJobPage } from "../../../_components/jobs/ImportJob";
import Page from "../../../_components/ui/Page";
import { importRunsCopy } from "@/lib/import-runs-copy";

type Params = { params: Promise<{ job: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireStaff();
  return { title: importRunsCopy.jobTitles[found(jobBySlug((await params).job))] };
}

/** One import or check: what it does, its button, and every run it has made, newest first. */
export default async function ImportJobRoute({ params }: Params) {
  await requireStaff();
  const job = found(jobBySlug((await params).job));
  const [runs, running] = await Promise.all([listRuns(job), runningNow(job)]);
  return (
    <Page kind="item" under="import" here={importRunsCopy.jobTitles[job]}>
      <ImportJobPage job={job} runs={runs} running={running} run={runJobNow.bind(null, job)} decide={decideImport} />
    </Page>
  );
}
