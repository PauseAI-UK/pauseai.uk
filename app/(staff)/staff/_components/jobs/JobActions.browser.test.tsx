import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import JobActions from "./JobActions";

describe("JobActions", () => {
  it("runs the job", async () => {
    const fn = vi.fn();
    await render(<JobActions action={fn} label="Run it" />);
    await page.getByRole("button", { name: "Run it" }).click();
    await vi.waitFor(() => expect(fn).toHaveBeenCalledOnce());
    expect(page.getByRole("link").all()).toHaveLength(0);
  });
});
