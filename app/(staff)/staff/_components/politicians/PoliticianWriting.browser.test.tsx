import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { AddressesBubbleExample, SalutationBubbleExample } from "./PoliticianWriting.gallery.client";
import { politiciansCopy } from "./copy";

describe("PoliticianWriting's examples in the gallery", () => {
  // Their Server Actions are logged, not sent: pressing each adds its line to the event log.
  const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");

  it("sets a Lord's email in its bubble, saying why it's theirs to set, and what the server answered", async () => {
    await render(<AddressesBubbleExample lord result={{ saved: false, why: "shared" }} />);
    const words = politiciansCopy.politician.editDetails;
    await expect.element(page.getByText(words.emailHint)).toBeVisible();
    // With no email, no other addresses to list, nor a way to add one.
    await expect.element(page.getByText(politiciansCopy.politician.aliases.title)).not.toBeInTheDocument();
    await page.getByRole("textbox", { name: words.email }).fill("contactholmember@parliament.uk");
    await page.getByRole("button", { name: words.save }).click();
    await expect.element(page.getByRole("status").first()).toHaveTextContent(words.refused.shared);
    await expect
      .element(log().nth(0))
      .toHaveTextContent(
        'editDetails({"politicianId":"7","salutation":"Lord Seedling","email":"contactholmember@parliament.uk"})',
      );
  });

  it("lists an MP's other addresses in their email's bubble, with a Remove by those staff can take off, and Add", async () => {
    await render(<AddressesBubbleExample result={{ saved: true }} />);
    const words = politiciansCopy.politician.aliases;
    await expect.element(page.getByRole("button", { name: words.more(7) })).toBeVisible();
    expect(document.querySelector("[popover]:popover-open")!.textContent).toContain("@pollyplaceholder.org.uk");
    // An MP's email is their body's: no field for it.
    await expect
      .element(page.getByRole("textbox", { name: politiciansCopy.politician.editDetails.email }))
      .not.toBeInTheDocument();
    await page.getByRole("button", { name: words.remove }).first().click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('removeAlias({"politicianId":"7","address":"jane.smith@parliament.uk"})');
    await expect.element(page.getByRole("button", { name: words.add })).toBeVisible();
  });

  it("changes a salutation in its bubble, closing it once saved, and offers Ms or Mr for one made from the name", async () => {
    const words = politiciansCopy.politician.editDetails;
    const { rerender } = await render(<SalutationBubbleExample result={{ saved: true }} />);
    await page.getByRole("button", { name: words.edit }).click();
    const field = page.getByRole("textbox", { name: words.salutation });
    await expect.element(field).toBeVisible();
    await page.getByRole("button", { name: words.save }).click();
    await expect
      .element(log().nth(0))
      .toHaveTextContent('editDetails({"politicianId":"7","salutation":"Ms Placeholder"})');
    await expect.element(field).not.toBeInTheDocument();
    await rerender(<SalutationBubbleExample fromName result={{ saved: false, why: "salutation" }} />);
    await page.getByRole("button", { name: words.edit }).click();
    await expect.element(page.getByText(words.fromName)).toBeVisible();
    await page.getByRole("button", { name: "Mr Placeholder" }).click();
    await expect
      .element(log().nth(1))
      .toHaveTextContent('editDetails({"politicianId":"7","salutation":"Mr Placeholder"})');
    // Refused, the bubble stays open.
    await expect.element(page.getByRole("button", { name: "Ms Placeholder" })).toBeVisible();
  });
});
