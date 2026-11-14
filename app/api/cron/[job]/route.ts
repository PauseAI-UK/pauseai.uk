import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/jobs/cron.server";
import { isImportJob, NIGHTLY } from "@/lib/import-runs";
import { runJob } from "@/lib/jobs/jobs.server";

/**
 * A scheduled run of a job, called by its function in netlify/functions/
 * (lib/jobs/jobs.server.ts). Says what the run did.
 */
export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const { job } = await params;
  if (!isImportJob(job)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await runJob(job, NIGHTLY, request));
}
