import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/server/cron";
import { NIGHTLY, SCHEDULED_JOBS } from "@/lib/import-runs";
import { runJob } from "@/lib/server/jobs";

/**
 * A scheduled run of a job, called by its function in netlify/functions/
 * (lib/server/jobs.ts). Says what the run did. A one-off job isn't here, as
 * only staff run it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const name = (await params).job;
  const job = SCHEDULED_JOBS.find((scheduled) => scheduled === name);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await runJob(job, NIGHTLY, request));
}
