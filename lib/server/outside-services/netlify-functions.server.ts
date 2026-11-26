import "server-only";
import { config } from "@/lib/server/config.server";
import { NIGHTLY } from "@/lib/import-runs";
import { siteUrl, siteUrlIfKnown } from "@/lib/site-url.server";
import { type JobStart, RUN_JOB } from "@/netlify/scheduled";
import { orFallback } from "./fallback.server";
import { refusal } from "./outside-failure.server";
import { noFake } from "@/lib/server/fixtures/fakes/none";
import { outsideFetch, type Outside } from "./outside-fetch.server";
import { serverProblems } from "@/lib/server/copy";

const NETLIFY: Outside = { service: "netlify", fake: noFake };

/** Whether this build has Netlify's functions to start, with the secret they need and its own address to start them at: none Netlify didn't make. */
export function hasJobFunction(): boolean {
  return !config.localBuild && Boolean(config.cronSecret) && siteUrlIfKnown("/", undefined) !== undefined;
}

/**
 * Starts the background function that runs every job on Netlify
 * (netlify/functions/run-job-background), on this deploy, which answers
 * at once. Throws an OutsideFailure if it doesn't start.
 */
export async function startJobFunction(start: JobStart): Promise<void> {
  const res = await outsideFetch(NETLIFY, siteUrl(`/.netlify/functions/${RUN_JOB}`, undefined).toString(), {
    method: "POST",
    headers: { Authorization: `Bearer ${config.cronSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify(start),
  });
  // A background function answers 202 as it starts.
  if (res.status !== 202) throw refusal("netlify", res);
}

/**
 * Starts the Luma import, as its schedule would, so what was just done on
 * Luma is copied without waiting for the next run. A build without
 * Netlify's functions does nothing. Never throws: the next scheduled run
 * copies it anyway.
 */
export async function startLumaImport(): Promise<void> {
  if (!hasJobFunction()) return;
  await orFallback(serverProblems.lumaImportNotStarted(), undefined, () =>
    startJobFunction({ job: "import-luma", startedBy: NIGHTLY }),
  );
}
