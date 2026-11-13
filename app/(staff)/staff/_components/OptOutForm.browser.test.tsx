import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { CONSENTS } from "@/lib/contact-permissions";
import { optOutChoices } from "@/lib/opt-out-choices";
import OptOutForm from "./OptOutForm";

const words = staffCopy.supporters.detail.permissions.recordOptOut;
const choices = optOutChoices([
  ...CONSENTS.map((c) => ({
    address: c.way === "email" ? "jane.smith@example.com" : "+447700900123",
    channel: c.way === "email" ? ("email" as const) : ("phone" as const),
    topic: c.topic,
    way: c.way,
    send: "yes" as const,
  })),
]);

describe("OptOutForm", () => {
  it("opens to choose what they opted out of, at which address or number, and how they told us", async () => {
    const record = vi.fn(async () => true);
    await render(<OptOutForm supporterId={4} choices={choices} record={record} />);
    await page.getByRole("button", { name: words.open }).click();
    // Nothing chosen to begin with, so nothing can be recorded yet.
    const what = page.getByRole("button", { name: `${words.what}: ${words.choose}` });
    await expect.element(page.getByRole("button", { name: words.record })).toBeDisabled();
    await what.click();
    // Under each address or number by each way, email, texts and calls apart.
    const menu = page.getByRole("list");
    expect(
      [...menu.element().querySelectorAll("li")]
        .filter((li) => !li.querySelector("button"))
        .map((li) => li.textContent),
    ).toEqual([
      `jane.smith@example.com (${words.ways.email})`,
      `07700 900123 (${words.ways.text})`,
      `07700 900123 (${words.ways.call})`,
    ]);
    await expect.element(menu.getByRole("button")).toHaveLength(8);
    await page.getByRole("button", { name: `${words.bulk}, jane.smith@example.com (${words.ways.email})` }).click();
    await expect
      .element(
        page.getByRole("button", {
          name: `${words.what}: ${words.bulk}, jane.smith@example.com (${words.ways.email})`,
        }),
      )
      .toBeVisible();
    await page.getByRole("textbox", { name: words.how }).fill("Asked at the Leeds stall");
    await page.getByRole("button", { name: words.record }).click();
    await expect.element(page.getByRole("button", { name: words.open })).toBeVisible();
    expect(Object.fromEntries((record.mock.calls[0] as unknown as [FormData])[0].entries())).toEqual({
      supporterId: "4",
      choice: "email|bulk|jane.smith@example.com",
      how: "Asked at the Leeds stall",
    });
    await expect.element(page.getByText(words.already)).not.toBeInTheDocument();
  });

  it("says when they were opted out of it already, and Cancel closes it unsent", async () => {
    const record = vi.fn(async () => false);
    await render(<OptOutForm supporterId={4} choices={choices} record={record} opened />);
    await page.getByRole("button", { name: words.cancel }).click();
    expect(record).not.toHaveBeenCalled();
    await page.getByRole("button", { name: words.open }).click();
    await page.getByRole("button", { name: `${words.what}: ${words.choose}` }).click();
    await page.getByRole("button", { name: `${words.bulk}, jane.smith@example.com (${words.ways.email})` }).click();
    await page.getByRole("textbox", { name: words.how }).fill("Phoned");
    await page.getByRole("button", { name: words.record }).click();
    await expect.element(page.getByText(words.already)).toBeVisible();
  });

  it("shows nothing for a supporter with no address or number", async () => {
    const { container } = await render(<OptOutForm supporterId={4} choices={[]} record={vi.fn()} />);
    expect(container.textContent).toBe("");
  });
});
