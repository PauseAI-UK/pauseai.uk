import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { lettersCopy } from "../letters/copy";
import OpenInGmail from "./OpenInGmail";

const copy = lettersCopy.lettersInbox;

describe("OpenInGmail", () => {
  it("links to the message, and its i opens which mailbox it needs, its lines apart though the i's line has no height", async () => {
    await render(<OpenInGmail href="https://mail.google.com/mail/#all/1" account="hello@pauseai.uk" />);
    await expect
      .element(page.getByRole("link", { name: copy.openInGmail }))
      .toHaveAttribute("href", "https://mail.google.com/mail/#all/1");
    await page.getByRole("button", { name: copy.gmailHelp.name }).click();
    const words = page.getByText(copy.gmailHelp.words("hello@pauseai.uk"));
    await expect.element(words).toBeVisible();
    await expect.element(page.getByText(copy.gmailHelp.title("hello@pauseai.uk"))).toBeVisible();
    // Several lines, each its own height, not laid over one another.
    expect(parseFloat(getComputedStyle(words.element()).lineHeight)).toBeGreaterThan(16);
  });
});
