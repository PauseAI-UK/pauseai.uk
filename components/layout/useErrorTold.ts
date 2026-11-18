"use client";

import { unstable_isUnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { useEffect } from "react";
import { reportBrowserError } from "@/lib/browser-errors";
import { reloadPage } from "@/lib/leave-page.client";

/**
 * Tells the site of the error that lost the page (app/global-error.tsx), if
 * the browser threw it. One the server threw arrives with a `digest` in
 * place of its words, and the server has kept it already
 * (instrumentation.ts).
 *
 * A page loaded before the site's last deploy calls its Server Actions by
 * the old build's IDs, which the new build doesn't know
 * (https://nextjs.org/docs/app/guides/server-actions#deployment-considerations).
 * That isn't a fault to tell of: the page reloads, as the new build, and the
 * person tries again.
 *
 * Such a page also asks for the old build's scripts as it goes to another
 * page, and the site no longer has them: Turbopack throws a ChunkLoadError,
 * having already tried again itself if the network failed. That page
 * reloads too, once: the new build names its own scripts, so the same
 * script failing again is a fault, and is told.
 */
export function useErrorTold(error: unknown, report = reportBrowserError, reload = reloadPage): void {
  useEffect(() => {
    if (unstable_isUnrecognizedActionError(error)) return reload();
    if (error instanceof Error && error.name === "ChunkLoadError" && firstTimeFailing(error.message)) return reload();
    const fromServer = typeof error === "object" && error !== null && "digest" in error;
    if (!fromServer) report("browser-page", error);
  }, [error, report, reload]);
}

/** The script failed to load, in Turbopack's words, kept across the reload by the tab. */
const LAST_CHUNK_FAILED = "chunk-load-failed";

/**
 * Whether this script hasn't failed in this tab before, so a reload may mend
 * it. Without the tab's storage it can't be known, so it's told rather than
 * risk reloading for ever.
 */
function firstTimeFailing(message: string): boolean {
  try {
    if (sessionStorage.getItem(LAST_CHUNK_FAILED) === message) return false;
    sessionStorage.setItem(LAST_CHUNK_FAILED, message);
    return true;
  } catch {
    return false;
  }
}
