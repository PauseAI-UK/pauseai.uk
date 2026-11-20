import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { londonWhen } from "@/lib/staff-time";
import { ChangeTimesFormExample, DraftFinishExample } from "./BroadcastTimes.gallery.client";
import { mailingsCopy } from "../mailings/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;
const hours = () => page.getByRole("combobox", { name: mailingsCopy.mailingPages.hour });

describe("BroadcastTimes' examples in the gallery", () => {
  it("says a draft keeps trying seven days, and changes it with its day and time", async () => {
    await render(<DraftFinishExample />);
    await expect
      .element(page.getByText(copy.keepsTrying(londonWhen(new Date("2027-01-22T09:18:00Z"), "short"))))
      .toBeVisible();
    await page.getByRole("button", { name: copy.changeFinish }).click();
    await expect.element(page.getByRole("button", { name: copy.keepsTryingUntil })).toBeVisible();
    await hours().selectOptions("7");
    await expect.element(hours()).toHaveValue("7");
  });

  it("moves when one scheduled keeps trying until with its time, and logs both", async () => {
    await render(<ChangeTimesFormExample scheduled />);
    // Its time, then a day on, when it keeps trying until.
    await expect.element(hours().first()).toHaveValue("9");
    await hours().first().selectOptions("11");
    await expect.element(hours().last()).toHaveValue("11");
    await page.getByRole("button", { name: copy.saveTimes }).click();
    await expect
      .element(
        page.getByText(
          /^rescheduleBroadcastNow\(\{"id":"5","day":"2027-01-15","hour":"11",.*"finish-day":"2027-01-16","finish-hour":"11"/,
        ),
      )
      .toBeVisible();
  });

  it("changes only when one sending keeps trying until", async () => {
    await render(<ChangeTimesFormExample scheduled={false} />);
    expect(hours().elements()).toHaveLength(1);
    await hours().selectOptions("10");
    await expect.element(hours()).toHaveValue("10");
    await page.getByRole("button", { name: copy.saveTimes }).click();
    await expect.element(page.getByText(/^rescheduleBroadcastNow\(\{"id":"5","finish-day":"2027-01-16"/)).toBeVisible();
  });
});
