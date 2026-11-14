import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import CampaignLetter from "./CampaignLetter";
import { exampleChanged, exampleVersions } from "./CampaignPages.examples";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.campaigns;
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("CampaignLetter", () => {
  it("leads to those who changed the wording, when anyone did", async () => {
    const { rerender } = await render(<CampaignLetter changedHref="/changed" versions={exampleVersions} changed={3} />);
    await expect
      .element(page.getByRole("link", { name: mailingsCopy.campaigns.changedLink(3) }))
      .toHaveAttribute("href", "/changed");
    await rerender(<CampaignLetter changedHref="/changed" versions={exampleVersions} changed={0} />);
    expect(page.getByRole("link").query()).toBeNull();
  });

  it("chooses among versions, each with its subject and text, names as chips", async () => {
    await render(<CampaignLetter changedHref="/changed" versions={exampleVersions} changed={exampleChanged} />);
    await says(exampleVersions[0].subject);
    await says(copy.fields.salutation);
    await page.getByRole("combobox").selectOptions("older");
    await says(exampleVersions[1].subject);
  });

  it("with one version, says how many it has, and with no one changing the wording, no link", async () => {
    await render(<CampaignLetter changedHref="/changed" versions={exampleVersions.slice(1)} changed={0} />);
    expect(page.getByRole("combobox").query()).toBeNull();
    expect(document.body.textContent).toContain(copy.versionLine("18 Jun 2026", 8));
    const { rerender } = await render(
      <CampaignLetter
        changedHref="/changed"
        versions={[{ ...exampleVersions[0], from: null }]}
        changed={exampleChanged}
      />,
    );
    expect(document.body.textContent).toContain(copy.versionLine(null, 4));
    await rerender(<CampaignLetter changedHref="/changed" versions={[]} changed={exampleChanged} />);
    await says(copy.noText);
  });
});
