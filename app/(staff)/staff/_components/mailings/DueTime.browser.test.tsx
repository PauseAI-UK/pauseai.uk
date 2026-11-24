import { describe, expect, it, onTestFinished, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused } from "@/lib/form-result";
import { ChangeTimeForm } from "./DueTime";
import { ChangeTimeFormExample, DueTimeFieldsExample } from "./DueTime.gallery.client";
import { mailingsCopy } from "./copy";

describe("DueTime's examples in the gallery", () => {
  it("picks a mailing's hour and minutes, and logs Change the time's save", async () => {
    // The example's day, early, as the fixture clock has it, so no hour's too soon whenever this runs.
    vi.useFakeTimers({ now: new Date("2026-10-16T06:00:00Z"), toFake: ["Date"] });
    onTestFinished(() => void vi.useRealTimers());
    const { unmount } = await render(<DueTimeFieldsExample />);
    const hour = page.getByRole("combobox", { name: mailingsCopy.mailingPages.hour });
    const minutes = page.getByRole("combobox", { name: mailingsCopy.mailingPages.minutes });
    await expect.element(minutes).toBeDisabled();
    await hour.selectOptions("15");
    await expect.element(hour).toHaveValue("15");
    await minutes.selectOptions("48");
    await expect.element(minutes).toHaveValue("48");
    await unmount();
    await render(<ChangeTimeFormExample />);
    await page.getByRole("button", { name: mailingsCopy.mailingPages.saveTime }).click();
    await expect.element(page.getByText(/^rescheduleMailingNow\(\{"id":"5"/)).toBeVisible();
    expect(page.getByRole("alert").all()).toHaveLength(0);
  });
});

describe("ChangeTimeForm", () => {
  it("says under its fields that the time chosen has passed, keeping the time", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-16T06:00:00Z"), toFake: ["Date"] });
    onTestFinished(() => void vi.useRealTimers());
    await render(
      <ChangeTimeForm
        id={5}
        dueAt={new Date("2027-01-15T09:03:00Z")}
        action={() => Promise.resolve(refused("too-soon"))}
      />,
    );
    const hour = page.getByRole("combobox", { name: mailingsCopy.mailingPages.hour });
    const minutes = page.getByRole("combobox", { name: mailingsCopy.mailingPages.minutes });
    await hour.selectOptions("15");
    await minutes.selectOptions("48");
    await page.getByRole("button", { name: mailingsCopy.mailingPages.saveTime }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(mailingsCopy.refusals.reschedule["too-soon"]);
    // What was chosen, not what the form started with.
    await expect.element(hour).toHaveValue("15");
    await expect.element(minutes).toHaveValue("48");
  });
});
