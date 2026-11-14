"use server";

// The Server Actions of the scheduled jobs' pages: a job's button, and
// applying or discarding a held import. Each is a public endpoint, so each
// calls requireStaff() before anything else (tests/checks/staff-auth.test.ts).
import { revalidatePath } from "next/cache";
import { type ImportJob, importPath, isImportJob } from "@/lib/import-runs";
import { runJob } from "@/lib/jobs/jobs.server";
import { actionRequest } from "@/lib/site-url.server";
import { idFrom } from "@/lib/staff-forms";
import { decideHeldImport, isPoliticianImport } from "@/lib/politicians/imports.server";
import { requireStaff } from "@/lib/accounts/auth.server";

/** Refreshes the pages that show a job's runs: its own, the overview of every job, and the home page's actions. */
function refreshImport(job: ImportJob): void {
  revalidatePath(importPath(job));
  revalidatePath("/staff/scheduled-jobs");
  revalidatePath("/staff");
}

/**
 * A job's button, bound to the job's name: runs it as the staff member,
 * unless a run of it is going (lib/jobs/jobs.server.ts), then refreshes its
 * pages. Any staff member may run any job. A failure is in the import log,
 * shown on its page like a scheduled one, so it's logged rather than
 * crashing the page.
 */
export async function runJobNow(job: string): Promise<void> {
  const { email } = await requireStaff();
  if (!isImportJob(job)) return;
  try {
    await runJob(job, email, await actionRequest());
  } catch (error) {
    console.error(error);
  }
  refreshImport(job);
}

/** Applies or discards a held import of a body's members, from its job's page. */
export async function decideImport(form: FormData): Promise<void> {
  const { email } = await requireStaff();
  const id = idFrom(form);
  const decision = form.get("decision");
  const job = String(form.get("job") ?? "");
  if (!id || (decision !== "apply" && decision !== "discard") || !isPoliticianImport(job)) return;
  await decideHeldImport(id, decision, email);
  refreshImport(job);
}
