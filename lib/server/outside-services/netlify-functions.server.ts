import "server-only";
import { config } from "@/lib/server/config.server";
import { siteUrlIfKnown } from "@/lib/site-url.server";
import { orFallback } from "./fallback.server";
import { refusal } from "./outside-failure.server";
import { outsideFetch } from "./outside-fetch.server";
import { serverProblems } from "@/lib/server/copy";

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
  await orFallback(serverProblems.lumaImportNotStarted(), undefined, async () => {
    const res = await outsideFetch("netlify", url.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${config.cronSecret}` },
    });
    // A background function answers 202 as it starts.
    if (res.status !== 202) throw refusal("netlify", res);
  });
}
