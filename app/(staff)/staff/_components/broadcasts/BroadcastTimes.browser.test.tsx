import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { londonWhen } from "@/lib/staff-time";
import { ChangeTimesFormExample, DraftFinishExample } from "./BroadcastTimes.gallery.client";
import { mailingsCopy } from "../mailings/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;
const length = () => page.getByRole("combobox", { name: copy.keepsTryingFor });
const until = (iso: string) => page.getByText(copy.untilWhen(londonWhen(new Date(iso), "short")));

describe("BroadcastTimes' examples in the gallery", () => {
  it("says a draft keeps trying seven days, and changes how long, saying until when, and why at length", async () => {
    await render(<DraftFinishExample />);
    await expect.element(length()).toHaveValue("10080");
    await expect.element(until("2027-01-22T09:18:00Z")).toBeVisible();
    await page.getByRole("button", { name: copy.whyKeepsTrying }).click();
    await expect.element(page.getByText(copy.keepsTryingWhy[1])).toBeVisible();
    // Half a day, then each day up to seven.
    expect([...length().element().querySelectorAll("option")].map((one) => one.textContent)).toEqual([
      copy.finishChoice(720),
      ...[1, 2, 3, 4, 5, 6, 7].map((days) => copy.finishChoice(days * 24 * 60)),
    ]);
    await length().selectOptions(copy.finishChoice(720));
    await expect.element(until("2027-01-15T21:18:00Z")).toBeVisible();
    await length().selectOptions(copy.finishChoice(7 * 24 * 60));
    await expect.element(until("2027-01-22T09:18:00Z")).toBeVisible();
  });

  it("changes one scheduled's time and how long it keeps trying, which moves with it, and logs both", async () => {
    await render(<ChangeTimesFormExample scheduled />);
    await expect.element(length()).toHaveValue("1440");
    await page.getByRole("combobox", { name: mailingsCopy.mailingPages.hour }).selectOptions("11");
    await expect.element(until("2027-01-16T11:18:00Z")).toBeVisible();
    await page.getByRole("button", { name: copy.saveTimes }).click();
    await expect
      .element(
        page.getByText(/^rescheduleBroadcastNow\(\{"id":"5","day":"2027-01-15","hour":"11",.*"finish-minutes":"1440"/),
      )
      .toBeVisible();
  });

  it("changes only how long one sending keeps trying", async () => {
    await render(<ChangeTimesFormExample scheduled={false} />);
    expect(page.getByRole("combobox", { name: mailingsCopy.mailingPages.hour }).elements()).toHaveLength(0);
    await length().selectOptions(copy.finishChoice(720));
    await page.getByRole("button", { name: copy.saveTimes }).click();
    await expect.element(page.getByText(/^rescheduleBroadcastNow\(\{"id":"5","finish-minutes":"720"\}/)).toBeVisible();
  });
});
