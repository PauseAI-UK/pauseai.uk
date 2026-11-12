// The contact preferences group's examples log what each action is sent, and give the page as it was.
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { emailSettingsCopy as copy } from "@/lib/content/email-settings";
import { exampleNoBulk, exampleSettings } from "@/app/(site)/contact-preferences/_components/EmailSettings.examples";
import { EmailSettingsExample, SettingsStartExample } from "./email-settings.client";

const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

describe("the contact preferences group's examples", () => {
  it("logs asking for a link", async () => {
    await render(<SettingsStartExample />);
    await page.getByRole("textbox", { name: copy.start.label }).fill("jane.smith@example.com");
    await page.getByRole("button", { name: copy.start.button }).click();
    await expect.element(log()).toHaveTextContent('ask({"email":"jane.smith@example.com","turnstileToken":""})');
  });

  it("logs each action of the page, by its link", async () => {
    await render(<EmailSettingsExample view={exampleSettings} unsubscribe={["newsletter"]} />);
    await page.getByRole("button", { name: copy.unsubscribe.button }).click();
    await page.getByRole("checkbox", { name: copy.ways.text }).first().click();
    await page.getByRole("button", { name: copy.stopAll.button }).click();
    await expect.element(log().nth(2)).toHaveTextContent('stopAll({"kind":"copy","token":"example"})');
    expect(log().nth(0).element().textContent).toContain("unsubscribe(");
    expect(log().nth(1).element().textContent).toContain("save(");
  });

  it("logs lifting “No bulk emails”, and asking for a fresh link", async () => {
    await render(<EmailSettingsExample view={exampleNoBulk} />);
    await page.getByRole("button", { name: copy.noBulk.button }).click();
    await expect.element(log()).toHaveTextContent('lift({"kind":"link","token":"example"})');
    await render(<EmailSettingsExample view={null} />);
    await page.getByRole("button", { name: copy.expired.button }).click();
    await expect.element(page.getByText(copy.expired.sent)).toBeVisible();
  });
});
