"use client";

import { useEffect } from "react";
import { fromOurScripts, reportBrowserError } from "@/lib/browser-errors";

/**
 * Tells the site of what the browser throws that no error page catches: an
 * error in a click or a timer, a promise that fails with nothing waiting on
 * it. Only an error with a frame from our own scripts in its stack, which
 * leaves out extensions, in-app browsers' scripts and other sites' ("Script
 * error."). Renders nothing. It listens on the window, unless given
 * something else to listen on.
 */
export default function ErrorReporter({
  report = reportBrowserError,
  on,
}: {
  report?: typeof reportBrowserError;
  on?: EventTarget;
}) {
  useEffect(() => {
    const target = on ?? window;
    const tell = (thrown: unknown) => {
      if (thrown instanceof Error && fromOurScripts(thrown.stack, window.location.origin)) {
        report("browser-other", thrown);
      }
    };
    const onError = (event: Event) => tell((event as ErrorEvent).error);
    const onRejection = (event: Event) => tell((event as PromiseRejectionEvent).reason);
    target.addEventListener("error", onError);
    target.addEventListener("unhandledrejection", onRejection);
    return () => {
      target.removeEventListener("error", onError);
      target.removeEventListener("unhandledrejection", onRejection);
    };
  }, [report, on]);
  return null;
}
