import "server-only";
import { config } from "@/lib/server/config";
import { siteUrlIfKnown } from "@/lib/site-url";
import { outsideFetch } from "./outside-fetch";

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
    await outsideFetch(url.toString(), {
      method: "POST",
      headers: { Authorization: `Bearer ${config.cronSecret}` },
    });
  } catch (error) {
    console.error("Couldn't start the Luma import:", error);
  }
}
