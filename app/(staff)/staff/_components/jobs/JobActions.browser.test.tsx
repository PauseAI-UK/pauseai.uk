import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import JobActions, { type RunJob } from "./JobActions";
import { JobActionsExample } from "./JobActions.gallery.client";

describe("JobActions", () => {
  it("runs the job", async () => {
    const fn = vi.fn<RunJob>(async () => ({ ok: true }));
    await render(<JobActions action={fn} label="Run it" />);
    await page.getByRole("button", { name: "Run it" }).click();
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce());
    expect(page.getByRole("link").all()).toHaveLength(0);
    await expect.element(page.getByRole("alert")).not.toBeInTheDocument();
  });

  it("says under the button that a press failed", async () => {
    // What a Server Action rejects with when the server threw: a digest, so the site isn't told of it again.
    const fn = vi.fn<RunJob>().mockRejectedValue(Object.assign(new Error("Server"), { digest: "1" }));
    await render(<JobActions action={fn} label="Run it" />);
    await page.getByRole("button", { name: "Run it" }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(staffVocabulary.notDone);
  });

  it("logs a press, in its example", async () => {
    await render(<JobActionsExample />);
    await page.getByRole("button", { name: "Check now" }).click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent("action({})");
  });
});
