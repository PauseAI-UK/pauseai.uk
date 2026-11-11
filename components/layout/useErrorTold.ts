"use client";

import { useEffect } from "react";
import { reportBrowserError } from "@/lib/browser-errors";

/**
 * Tells the site of the error that lost the page (app/global-error.tsx), if
 * the browser threw it. One the server threw arrives with a `digest` in
 * place of its words, and the server has kept it already
 * (instrumentation.ts).
 */
export function useErrorTold(error: unknown, report = reportBrowserError): void {
  useEffect(() => {
    const fromServer = typeof error === "object" && error !== null && "digest" in error;
    if (!fromServer) report("browser-page", error);
  }, [error, report]);
}
