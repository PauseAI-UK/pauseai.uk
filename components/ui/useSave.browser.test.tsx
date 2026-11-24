import { getRedirectError } from "next/dist/client/components/redirect";
import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { Component, type ReactNode, useOptimistic } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import type { reportBrowserError } from "@/lib/browser-errors";
import { useSave } from "./useSave";

const reports = () => vi.fn<typeof reportBrowserError>();

/** A save that waits to be told how it ends. */
function held<Result>() {
  let settle!: { resolve: (result: Result) => void; reject: (error: unknown) => void };
  const save = vi.fn<(name: string, on: boolean) => Promise<Result>>(
    () => new Promise<Result>((resolve, reject) => (settle = { resolve, reject })),
  );
  return {
    save,
    resolve: (result: Result) => settle.resolve(result),
    reject: (error: unknown) => settle.reject(error),
  };
}

/** A box that saves as it's pressed, showing how the save stands. */
function Saver({
  save,
  done,
  report,
}: {
  save: (name: string, on: boolean) => Promise<string>;
  done?: (result: string, name: string, on: boolean) => void;
  report?: typeof reportBrowserError;
}) {
  const [shown, show] = useOptimistic("off");
  const [run, saving, failed] = useSave(save, { before: (_name, on) => show(on ? "on" : "off"), done, report });
  return (
    <>
      <button type="button" onClick={() => run("news", true)}>
        Save
      </button>
      <output>{`${shown} ${saving ? "saving" : "still"} ${failed ? "failed" : "fine"}`}</output>
    </>
  );
}

/** Catches what a transition throws on, as an error page does. */
class Boundary extends Component<{ caught: (error: unknown) => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError = () => ({ failed: true });
  componentDidCatch(error: unknown) {
    this.props.caught(error);
  }
  render() {
    return this.state.failed ? <p>Caught</p> : this.props.children;
  }
}

describe("useSave", () => {
  it("calls the save with what it's given, says it's saving, shows what's hoped for, and hands on the answer", async () => {
    const { save, resolve } = held<string>();
    const done = vi.fn();
    await render(<Saver save={save} done={done} />);
    await expect.element(page.getByRole("status")).toHaveTextContent("off still fine");
    await page.getByRole("button").click();
    await expect.element(page.getByRole("status")).toHaveTextContent("on saving fine");
    expect(save).toHaveBeenCalledWith("news", true);
    resolve("kept");
    await expect.element(page.getByRole("status")).toHaveTextContent("off still fine");
    expect(done).toHaveBeenCalledWith("kept", "news", true);
  });

  it("says a save failed, tells the site of what the browser threw, and starts afresh at the next", async () => {
    const first = held<string>();
    const save = vi.fn(first.save);
    const report = reports();
    await render(<Saver save={save} report={report} />);
    await page.getByRole("button").click();
    const thrown = new TypeError("Failed to fetch");
    first.reject(thrown);
    // What was hoped for is undone, and nothing is handed on.
    await expect.element(page.getByRole("status")).toHaveTextContent("off still failed");
    expect(report.mock.calls).toEqual([["browser-other", thrown]]);
    const second = held<string>();
    save.mockImplementation(second.save);
    await page.getByRole("button").click();
    await expect.element(page.getByRole("status")).toHaveTextContent("on saving fine");
    second.resolve("kept");
    await expect.element(page.getByRole("status")).toHaveTextContent("off still fine");
  });

  it("says a save failed that the server threw, without telling the site of what it has already", async () => {
    const { save, reject } = held<string>();
    const report = reports();
    await render(<Saver save={save} report={report} />);
    await page.getByRole("button").click();
    reject(Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1" }));
    await expect.element(page.getByRole("status")).toHaveTextContent("off still failed");
    expect(report).not.toHaveBeenCalled();
  });

  it.each([
    ["a redirect, which Next follows", () => getRedirectError("/staff", "push" as never)],
    [
      "a Server Action of a build since replaced, which the error page reloads for",
      () => new UnrecognizedActionError(),
    ],
  ])("throws on %s", async (_what, thrown) => {
    const { save, reject } = held<string>();
    const report = reports();
    const caught = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await render(
      <Boundary caught={caught}>
        <Saver save={save} report={report} />
      </Boundary>,
    );
    await page.getByRole("button").click();
    const error = thrown();
    reject(error);
    await expect.element(page.getByText("Caught")).toBeVisible();
    expect(caught).toHaveBeenCalledWith(error);
    expect(report).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
