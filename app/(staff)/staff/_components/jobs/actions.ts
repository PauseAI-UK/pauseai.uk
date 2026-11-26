"use server";

// The Server Actions of the scheduled jobs' pages: a job's button, and
// applying or discarding a held import. Each is a public endpoint, so each
// calls requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { refused, type FormResult } from "@/lib/form-result";
import { type ImportJob, importPath, isImportJob } from "@/lib/import-runs";
import { startJob } from "@/lib/jobs/start-job.server";
import { keepCaught } from "@/lib/oversight/errors-seen.server";
import { actionRequest } from "@/lib/site-url.server";
import { ownId } from "@/lib/staff-forms";
import { decideHeldImport, isPoliticianImport } from "@/lib/politicians/imports.server";
import { requireStaff } from "@/lib/accounts/auth.server";

/** Refreshes the pages that show a job's runs: its own, the overview of every job, and the home page's actions. */
function refreshImport(job: ImportJob): void {
  revalidatePath(importPath(job));
  revalidatePath("/staff/scheduled-jobs");
  revalidatePath("/staff");
}

/**
 * A job's button, bound to the job's name: starts a run of it by the staff
 * member, unless a run of it is going (lib/jobs/start-job.server.ts), and
 * answers at once, its pages refreshed to show it running. Any staff member
 * may run any job. The run's end is in the import log, shown on its page
 * like a scheduled one's. A run that won't start is kept as an error, as a
 * scheduled one's is when it's thrown, rather than crashing the page. The
 * name is the page's own, so thrown when it isn't a job's.
 */
export async function runJobNow(job: string): Promise<FormResult<never>> {
  const { email } = await requireStaff();
  if (!isImportJob(job)) throw new Error("A job's button came with a name that isn't a job's");
  try {
    await startJob(job, email, await actionRequest());
  } catch (error) {
    await keepCaught(error, importPath(job));
  }
  refreshImport(job);
  return { ok: true };
}

/**
 * Applies or discards a held import of a body's members, from its job's
 * page. Which import, which job and which of the two are the form's own, so
 * thrown when they aren't those. Refused for an import no longer held, as
 * someone else decided it or a newer run replaced it since the page loaded.
 */
export async function decideImport(form: FormData): Promise<FormResult<"gone">> {
  const { email } = await requireStaff();
  const id = ownId(form);
  const decision = form.get("decision");
  const job = String(form.get("job") ?? "");
  if (decision !== "apply" && decision !== "discard") throw new Error("A held import's form came without its decision");
  if (!isPoliticianImport(job)) throw new Error("A held import's form came for a job that holds none");
  const decided = await decideHeldImport(id, decision, email);
  refreshImport(job);
  return decided ? { ok: true } : refused("gone");
}
