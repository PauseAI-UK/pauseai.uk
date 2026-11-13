import type { Metadata } from "next";
import { jobTitles } from "@/lib/content/staff-interface";
import { found } from "@/lib/found";
import { jobBySlug } from "@/lib/import-runs";
import { PARLIAMENTARIANS_TABLE_URL } from "@/lib/server/outside-services/airtable";
import { listRuns, runningNow } from "@/lib/server/import-runs";
import { requireStaff } from "@/lib/server/staff-auth";
import { decideImport, runJobNow } from "../../../actions";
import { ImportJobPage } from "../../../_components/ImportJob";
import Page from "../../../_components/ui/Page";

type Params = { params: Promise<{ job: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  await requireStaff();
  return { title: jobTitles[found(jobBySlug((await params).job))] };
}

/** One import or check: what it does, its button, and every run it has made, newest first. */
export default async function ImportJobRoute({ params }: Params) {
  await requireStaff();
  const job = found(jobBySlug((await params).job));
  const [runs, running] = await Promise.all([listRuns(job), runningNow(job)]);
  return (
    <Page kind="item" under="import" here={jobTitles[job]}>
      <ImportJobPage
        job={job}
        runs={runs}
        running={running}
        run={runJobNow.bind(null, job)}
        decide={decideImport}
        airtableTable={PARLIAMENTARIANS_TABLE_URL}
      />
    </Page>
  );
}
