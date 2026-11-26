import "server-only";
import { after } from "next/server";
import { importPath, type ImportJob } from "@/lib/import-runs";
import { keepCaught } from "@/lib/oversight/errors-seen.server";
import { startRunning, stopRunning } from "@/lib/server/import-runs.server";
import { hasJobFunction, startJobFunction } from "@/lib/server/outside-services/netlify-functions.server";
import { runJob } from "./jobs.server";

// A staff member's run of a job, from its button: started, not waited for,
// so the button answers at once whatever the run's length. The job is
// marked running first, so the page that comes back shows it going.

/**
 * Starts a run of `job` by `startedBy`, unless a run of it is going, and
 * says whether it started. On Netlify it's the background function's, as a
 * scheduled run is (netlify/scheduled.ts), which goes on for 15 minutes. A
 * build without Netlify's functions, such as a local or fixture one, runs
 * it itself once it has answered; `request` is for the links that run
 * emails (runJob). Throws if the background function won't start, leaving
 * the job free to run.
 */
export async function startJob(job: ImportJob, startedBy: string, request: Request | undefined): Promise<boolean> {
  if (!(await startRunning(job, startedBy))) return false;
  if (!hasJobFunction()) {
    after(async () => {
      try {
        await runJob(job, startedBy, request, { marked: true });
      } catch (error) {
        // The run is kept as failed already; this keeps the error, as a scheduled run's is when it's thrown.
        await keepCaught(error, importPath(job));
      }
    });
    return true;
  }
  try {
    await startJobFunction({ job, startedBy, marked: true });
  } catch (error) {
    await stopRunning(job);
    throw error;
  }
  return true;
}
