import { getRedirectError } from "next/dist/client/components/redirect";
import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import { Component, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import type { reportBrowserError } from "@/lib/browser-errors";
import { refused, type FormResult } from "@/lib/form-result";
import { useFormResult, type NotDone } from "./useFormResult";

type Reason = "blank" | "gone";
type Answer = FormResult<Reason, { id?: number }>;

const reports = () => vi.fn<typeof reportBrowserError>();

/** An action that waits to be told how it ends. */
function held() {
  let settle!: { resolve: (result: Answer) => void; reject: (error: unknown) => void };
  const action = vi.fn<(form: FormData) => Promise<Answer>>(
    () => new Promise<Answer>((resolve, reject) => (settle = { resolve, reject })),
  );
  return {
    action,
    resolve: (result: Answer) => settle.resolve(result),
    reject: (error: unknown) => settle.reject(error),
  };
}

/** A form on the hook, showing how it stands. */
function Sender({
  action,
  ...options
}: {
  action: (form: FormData) => Promise<Answer>;
  starts?: NotDone<Reason>;
  before?: () => void;
  done?: (result: { ok: true; id?: number }) => void;
  elsewhere?: (reason: Reason) => boolean;
  report?: typeof reportBrowserError;
}) {
  const [send, notDone, sending, sent] = useFormResult(action, options);
  return (
    <form action={send}>
      <input type="hidden" name="name" value="One" />
      <button type="submit">Send</button>
      <output>{`${sending ? "sending" : "still"} ${notDone ?? "fine"}${sent ? `, sent ${String(sent.get("name"))}` : ""}`}</output>
    </form>
  );
}

/** Catches what a form's action throws on, as an error page does. */
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

const stands = () => page.getByRole("status");

describe("useFormResult", () => {
  it("sends the form, says it's sending, and hands on the answer when it's done", async () => {
    const { action, resolve } = held();
    const before = vi.fn();
    const done = vi.fn();
    await render(<Sender action={action} before={before} done={done} />);
    await expect.element(stands()).toHaveTextContent("still fine");
    await page.getByRole("button").click();
    await expect.element(stands()).toHaveTextContent("sending fine");
    expect(before).toHaveBeenCalledOnce();
    expect(action.mock.calls[0][0].get("name")).toBe("One");
    resolve({ ok: true, id: 3 });
    await expect.element(stands()).toHaveTextContent("still fine");
    expect(done.mock.calls[0][0]).toEqual({ ok: true, id: 3 });
    expect((done.mock.calls[0][1] as FormData).get("name")).toBe("One");
  });

  it("says why a form was refused, until it's sent again and done", async () => {
    const first = held();
    const action = vi.fn(first.action);
    const done = vi.fn();
    await render(<Sender action={action} done={done} />);
    await page.getByRole("button").click();
    first.resolve(refused("blank"));
    await expect.element(stands()).toHaveTextContent("still blank, sent One");
    expect(done).not.toHaveBeenCalled();
    const second = held();
    action.mockImplementation(second.action);
    await page.getByRole("button").click();
    second.resolve({ ok: true });
    await expect.element(stands()).toHaveTextContent("still fine");
  });

  it("starts as not done for what it's given", async () => {
    await render(<Sender action={held().action} starts="gone" />);
    await expect.element(stands()).toHaveTextContent("still gone");
  });

  it("leaves a refusal that's said elsewhere to there, and keeps the rest", async () => {
    const first = held();
    const action = vi.fn(first.action);
    const elsewhere = vi.fn((reason: Reason) => reason === "gone");
    await render(<Sender action={action} elsewhere={elsewhere} />);
    await page.getByRole("button").click();
    first.resolve(refused("gone"));
    await expect.poll(() => elsewhere.mock.calls).toEqual([["gone"]]);
    await expect.element(stands()).toHaveTextContent("still fine");
    const second = held();
    action.mockImplementation(second.action);
    await page.getByRole("button").click();
    second.resolve(refused("blank"));
    await expect.element(stands()).toHaveTextContent("still blank, sent One");
  });

  it("says a form failed, and tells the site of what the browser threw", async () => {
    const { action, reject } = held();
    const report = reports();
    await render(<Sender action={action} report={report} />);
    await page.getByRole("button").click();
    const thrown = new TypeError("Failed to fetch");
    reject(thrown);
    await expect.element(stands()).toHaveTextContent("still failed, sent One");
    expect(report.mock.calls).toEqual([["browser-other", thrown]]);
  });

  it("says a form failed that the server threw, without telling the site of what it has already", async () => {
    const { action, reject } = held();
    const report = reports();
    await render(<Sender action={action} report={report} />);
    await page.getByRole("button").click();
    reject(Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1" }));
    await expect.element(stands()).toHaveTextContent("still failed, sent One");
    expect(report).not.toHaveBeenCalled();
  });

  it.each([
    ["a redirect, which Next follows", () => getRedirectError("/staff", "push" as never)],
    [
      "a Server Action of a build since replaced, which the error page reloads for",
      () => new UnrecognizedActionError(),
    ],
  ])("throws on %s", async (_what, thrown) => {
    const { action, reject } = held();
    const report = reports();
    const caught = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    await render(
      <Boundary caught={caught}>
        <Sender action={action} report={report} />
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
