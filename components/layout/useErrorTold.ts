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
 */
export function useErrorTold(error: unknown, report = reportBrowserError, reload = reloadPage): void {
  useEffect(() => {
    if (unstable_isUnrecognizedActionError(error)) return reload();
    const fromServer = typeof error === "object" && error !== null && "digest" in error;
    if (!fromServer) report("browser-page", error);
  }, [error, report, reload]);
}
