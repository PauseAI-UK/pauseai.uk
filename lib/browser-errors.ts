import type { BrowserKind } from "./error-key";

// An error in this browser, told to the site (/api/browser-error), which
// keeps it beside the server's own (lib/server/errors-seen.ts). The error
// page tells of what lost it the page (app/global-error.tsx), and a listener of anything else thrown from our own scripts
// (components/layout/ErrorReporter.tsx).

/** Where a browser posts an error. */
export const BROWSER_ERROR_PATH = "/api/browser-error";

/** How many errors one load of a page tells the site of, so a loop of errors isn't a loop of requests. */
export const REPORTS_A_PAGE = 5;

/** How much of an error's words and stack are sent. */
const WORDS_SENT = 2000;
const STACK_SENT = 8000;

/** What's posted: every field text, and the path the page's own. */
export type BrowserErrorBody = { kind: BrowserKind; name: string; words: string; stack: string; path: string };

/** Something thrown, as what's posted of it. */
function bodyOf(kind: BrowserKind, thrown: unknown, path: string): BrowserErrorBody {
  const error = thrown instanceof Error ? thrown : undefined;
  return {
    kind,
    name: error ? error.name : typeof thrown,
    words: (error ? error.message : String(thrown)).slice(0, WORDS_SENT),
    stack: (error?.stack ?? "").slice(0, STACK_SENT),
    path,
  };
}

/** Whether a stack has a frame from one of the site's own scripts, as against an extension's or another site's. */
export function fromOurScripts(stack: string | undefined, origin: string): boolean {
  return Boolean(stack?.includes(`${origin}/_next/`));
}

/**
 * Makes what tells the site of this page's errors: each thing thrown once,
 * however many times it's caught, and no more than REPORTS_A_PAGE in all.
 * The request outlives the page, and its failing is nobody's problem.
 */
export function browserErrorReporter(): (kind: BrowserKind, thrown: unknown) => void {
  const told = new WeakSet<object>();
  let reports = 0;
  return (kind, thrown) => {
    if (typeof thrown === "object" && thrown !== null) {
      if (told.has(thrown)) return;
      told.add(thrown);
    }
    if (reports >= REPORTS_A_PAGE) return;
    reports += 1;
    void fetch(BROWSER_ERROR_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyOf(kind, thrown, window.location.pathname)),
      keepalive: true,
    }).catch(() => {});
  };
}

/** This page's. */
export const reportBrowserError = browserErrorReporter();
