import "server-only";
import { staffCopy } from "@/lib/content/staff-interface";
import { config } from "@/lib/server/config.server";
import { problem } from "@/lib/server/problems.server";
import { siteUrlIfKnown } from "@/lib/site-url.server";
import { outsideFetch } from "./outside-fetch.server";

/**
 * Starts the Luma import in its background function on Netlify
 * (netlify/functions/import-luma-background), which answers at once and runs
 * it as its schedule would, so what was just done on Luma is copied without
 * waiting for the next run. A build Netlify didn't make has no background
 * functions, so there it does nothing. Never throws: the next scheduled run
 * copies it anyway.
 */
export async function startLumaImport(): Promise<void> {
  const url = siteUrlIfKnown("/.netlify/functions/import-luma-background", undefined);
  if (config.localBuild || !config.cronSecret || !url) return;
  try {
    const res = await outsideFetch(url.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${config.cronSecret}` },
    });
    // A background function answers 202 as it starts.
    if (res.status !== 202) problem(staffCopy.problems.logs.lumaImportNotStarted, `It answered ${res.status}`);
  } catch (error) {
    problem(staffCopy.problems.logs.lumaImportNotStarted, error);
  }
}
