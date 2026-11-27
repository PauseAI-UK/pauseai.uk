import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import CampaignLetter from "./CampaignLetter";
import { exampleConditions, exampleVersions } from "./CampaignPages.examples";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.campaigns;
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("CampaignLetter", () => {
  it("shows the latest version, and chooses among the earlier ones, each with its subject and text, names as chips and parts by who they're for", async () => {
    await render(<CampaignLetter versions={exampleVersions} conditions={exampleConditions} />);
    await says(exampleVersions[0].subject);
    await says(copy.fields.salutation);
    await says(copy.fields.sender);
    // When it was published, by whom, and its letters, under it; the earlier ones behind a link.
    await says(copy.versionLine("23 Sept 2026", "jane.smith@pauseai.uk", 4));
    // Named as staff pages name staff, free to break before the @.
    expect(document.querySelector("wbr")).not.toBeNull();
    expect(page.getByRole("combobox").query()).toBeNull();
    await page.getByRole("button", { name: copy.earlierVersions(2) }).click();
    await page.getByRole("combobox").selectOptions("1");
    await says(exampleVersions[1].subject);
    await says("signed ControlAI's letter to the Prime Minister");
    await page.getByRole("combobox").selectOptions("before");
    await says(copy.ownDrafts);
    expect(document.body.textContent).toContain(copy.beforeVersions(3));
  });

  it("with one version, says when and how many it has, with no way to earlier ones", async () => {
    await render(<CampaignLetter versions={exampleVersions.slice(1, 2)} />);
    expect(page.getByRole("combobox").query()).toBeNull();
    expect(page.getByRole("button").query()).toBeNull();
    await says(copy.versionLine("18 Jun 2026", null, 8));
    const { rerender } = await render(<CampaignLetter versions={[{ ...exampleVersions[0], from: null, by: null }]} />);
    await says(copy.versionLine(null, null, 4));
    await rerender(<CampaignLetter versions={[]} />);
    await says(copy.noText);
  });

  it("says the letters from before versions keep their own drafts, when they're all there is", async () => {
    await render(<CampaignLetter versions={exampleVersions.slice(2)} />);
    await says(copy.ownDrafts);
    await says(copy.beforeVersions(3));
  });
});
