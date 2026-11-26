import { NextResponse } from "next/server";
import { isCronRequest } from "@/lib/jobs/cron.server";
import { isImportJob, NIGHTLY } from "@/lib/import-runs";
import { runJob } from "@/lib/jobs/jobs.server";
import { parseJsonIfAny } from "@/lib/server/json.server";

/** Who the call says started the run, and whether it's marked running already; a call with no body is the schedule's. */
type Start = { startedBy: string; marked: boolean };

/** What the call's body says, or undefined if it isn't that. */
async function startOf(request: Request): Promise<Start | undefined> {
  const text = await request.text();
  if (!text) return { startedBy: NIGHTLY, marked: false };
  const said = parseJsonIfAny(text);
  if (typeof said !== "object" || said === null) return undefined;
  const { startedBy = NIGHTLY, marked = false } = said as Partial<Record<keyof Start, unknown>>;
  return typeof startedBy === "string" && typeof marked === "boolean" ? { startedBy, marked } : undefined;
}

/**
 * A run of a job, called by the background function that runs every job
 * (netlify/functions/run-job-background), with who started it: the
 * schedule or a staff member (lib/jobs/jobs.server.ts). Says what the run did.
 */
export async function POST(request: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!isCronRequest(request)) return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  const { job } = await params;
  if (!isImportJob(job)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const start = await startOf(request);
  if (!start) return NextResponse.json({ error: "Not a job's start" }, { status: 400 });
  return NextResponse.json(await runJob(job, start.startedBy, request, start));
}
