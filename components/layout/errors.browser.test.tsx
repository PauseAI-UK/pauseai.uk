import { notFound } from "next/dist/client/components/not-found";
import { getRedirectError } from "next/dist/client/components/redirect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import type { reportBrowserError } from "@/lib/browser-errors";
import ErrorReporter from "./ErrorReporter";
import { useErrorTold } from "./useErrorTold";

afterEach(() => vi.restoreAllMocks());

const reports = () => vi.fn<typeof reportBrowserError>();

/** An error as the server's arrives: its words gone, a digest in their place. */
const fromServer = () =>
  Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1234" });

/** What the error page does with what it caught. */
function Told({ error, report }: { error: unknown; report?: typeof reportBrowserError }) {
  useErrorTold(error, report);
  return null;
}

describe("useErrorTold", () => {
  it("tells the site of an error the browser threw, and not of one the server did", async () => {
    const report = reports();
    const thrown = new TypeError("rows is undefined");
    const { rerender } = await render(<Told error={thrown} report={report} />);
    expect(report.mock.calls).toEqual([["browser-page", thrown]]);
    await rerender(<Told error={fromServer()} report={report} />);
    await rerender(<Told error="a string" report={report} />);
    await rerender(<Told error={null} report={report} />);
    expect(report.mock.calls).toEqual([
      ["browser-page", thrown],
      ["browser-page", "a string"],
      ["browser-page", null],
    ]);
  });

  it("tells the site itself when nothing else is given to", async () => {
    const fetch = vi.spyOn(window, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await render(<Told error={new Error("Thrown in the browser")} />);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("ErrorReporter", () => {
  /** An error whose stack has a frame of the site's own scripts, or another's. */
  function thrownFrom(script: string) {
    const error = new Error("In a click");
    error.stack = `Error: In a click\n    at onClick (${script}:1:2345)`;
    return error;
  }
  const ours = () => thrownFrom(`${window.location.origin}/_next/static/chunks/4f2a.js`);

  // The events go to a target of the test's own: one sent to the window is an error to the test runner too.
  it("renders nothing, and tells the site of an error or a failed promise from our own scripts", async () => {
    const report = reports();
    const on = new EventTarget();
    const { container } = await render(<ErrorReporter report={report} on={on} />);
    expect(container.innerHTML).toBe("");
    const [inClick, inPromise] = [ours(), ours()];
    on.dispatchEvent(new ErrorEvent("error", { error: inClick }));
    const failed = Promise.reject(inPromise);
    failed.catch(() => {});
    on.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", { promise: failed, reason: inPromise }));
    expect(report.mock.calls).toEqual([
      ["browser-other", inClick],
      ["browser-other", inPromise],
    ]);
  });

  it("leaves out an extension's error, another site's with no detail, and what isn't an Error", async () => {
    const report = reports();
    const on = new EventTarget();
    await render(<ErrorReporter report={report} on={on} />);
    on.dispatchEvent(new ErrorEvent("error", { error: thrownFrom("chrome-extension://abcdef/content.js") }));
    on.dispatchEvent(new ErrorEvent("error", { message: "Script error." }));
    on.dispatchEvent(new ErrorEvent("error", { error: "a string" }));
    expect(report).not.toHaveBeenCalled();
  });

  it("leaves out Next's redirect and not-found, which aren't errors", async () => {
    // A Server Action that redirects, run from a click that doesn't wait for
    // it, leaves Next's redirect as a failed promise no one waits on.
    const ourStack = (signal: Error) => Object.assign(signal, { stack: ours().stack });
    let lost: Error;
    try {
      notFound();
    } catch (thrown) {
      lost = thrown as Error;
    }
    const report = reports();
    const on = new EventTarget();
    await render(<ErrorReporter report={report} on={on} />);
    for (const signal of [getRedirectError("/staff/broadcasts/1", "push"), lost!].map(ourStack)) {
      const failed = Promise.reject(signal);
      failed.catch(() => {});
      on.dispatchEvent(new PromiseRejectionEvent("unhandledrejection", { promise: failed, reason: signal }));
      on.dispatchEvent(new ErrorEvent("error", { error: signal }));
    }
    expect(report).not.toHaveBeenCalled();
  });

  it("stops listening once it's gone", async () => {
    const report = reports();
    const on = new EventTarget();
    const { unmount } = await render(<ErrorReporter report={report} on={on} />);
    await unmount();
    on.dispatchEvent(new ErrorEvent("error", { error: ours() }));
    expect(report).not.toHaveBeenCalled();
  });

  it("tells the site itself when nothing else is given to", async () => {
    const fetch = vi.spyOn(window, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const on = new EventTarget();
    await render(<ErrorReporter on={on} />);
    on.dispatchEvent(new ErrorEvent("error", { error: ours() }));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("listens on the window when given nothing else to", async () => {
    const listened = vi.spyOn(window, "addEventListener");
    const unlistened = vi.spyOn(window, "removeEventListener");
    const { unmount } = await render(<ErrorReporter report={reports()} />);
    const heard = (spy: typeof listened) => spy.mock.calls.map(([type]) => type);
    expect(heard(listened)).toEqual(expect.arrayContaining(["error", "unhandledrejection"]));
    await unmount();
    expect(heard(unlistened)).toEqual(expect.arrayContaining(["error", "unhandledrejection"]));
  });
});
