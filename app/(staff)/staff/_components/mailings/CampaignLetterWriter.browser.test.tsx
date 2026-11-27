import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import CampaignLetterWriter, { type CampaignLetterActions } from "./CampaignLetterWriter";
import {
  exampleAsks,
  exampleCampaignConditions,
  exampleCampaignDraft,
  exampleMps,
} from "./CampaignLetterWriter.examples";
import { mailingsCopy } from "./copy";

afterEach(() => sessionStorage.clear());

const copy = mailingsCopy.campaignLetter;
const WAIT = { timeout: 3000 };
const SIGNED = "signed ControlAI's letter to the Prime Minister";

function fakeActions(publish: () => unknown = () => ({ ok: true })) {
  let version = exampleCampaignDraft.version;
  return {
    save: vi.fn(async () => ({ ok: true, version: ++version })),
    publish: vi.fn(async () => publish()),
    discard: vi.fn(async () => ({ ok: true })),
  };
}

async function renderWriter(props: Partial<Parameters<typeof CampaignLetterWriter>[0]> = {}, actions = fakeActions()) {
  await render(
    <CampaignLetterWriter
      title="Support the bill"
      draft={exampleCampaignDraft}
      mps={exampleMps}
      asks={exampleAsks}
      conditions={exampleCampaignConditions}
      actions={actions as unknown as CampaignLetterActions}
      {...props}
    />,
  );
  return actions;
}

const preview = () => page.getByRole("region", { name: copy.preview });
const publish = () => page.getByRole("button", { name: copy.publish });

describe("CampaignLetterWriter", () => {
  it("shows the draft's subject and letter, and the letter as the first MP's constituent starts from it", async () => {
    await renderWriter();
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent(copy.title("Support the bill"));
    await expect
      .element(page.getByLabelText(mailingsCopy.mailingPages.subject))
      .toHaveValue(exampleCampaignDraft.subject);
    await expect.element(preview().getByText("Dear Mx McTestface,")).toBeVisible();
    await expect.element(preview().getByText("Thank you for signing.")).toBeVisible();
    // Signed with an example sender, as each supporter's own goes there.
    await expect.element(preview().getByText(copy.exampleAddress[0], { exact: false })).toBeVisible();
  });

  it("shows it for an MP who didn't sign, chosen by the part's button or from the list", async () => {
    await renderWriter();
    await preview().getByRole("button", { name: SIGNED }).click();
    await expect.element(preview().getByText("Dear Mr McTestface,")).toBeVisible();
    await expect.element(preview().getByText("Thank you for signing.")).not.toBeInTheDocument();
    await preview().getByRole("combobox").selectOptions(String(exampleMps[0].id));
    await expect.element(preview().getByText("Thank you for signing.")).toBeVisible();
  });

  it("shows no letter when no MP has the answers pressed, and says when there are no MPs at all", async () => {
    await renderWriter({ mps: exampleMps.slice(0, 1) });
    await preview().getByRole("button", { name: SIGNED }).click();
    await expect.element(preview().getByText(mailingsCopy.mailingPages.noOneMix)).toBeVisible();
  });

  it("says there are no MPs to preview for, without any", async () => {
    await renderWriter({ mps: [] });
    await expect.element(preview().getByText(copy.noMps)).toBeVisible();
  });

  it("saves what's typed, and publishes the draft at the version it's saved at", async () => {
    const actions = await renderWriter();
    await userEvent.fill(page.getByLabelText(mailingsCopy.mailingPages.subject), "Come to the debate");
    await vi.waitFor(() => expect(actions.save).toHaveBeenCalledWith(7, 3, { subject: "Come to the debate" }), WAIT);
    await expect.element(preview().getByText("Come to the debate")).toBeVisible();
    await publish().click();
    await vi.waitFor(() => expect(actions.publish).toHaveBeenCalledWith(7, 4));
  });

  it("saves what's typed in the letter, and shows it in the preview", async () => {
    const actions = await renderWriter();
    const letter = page.getByRole("textbox", { name: mailingsCopy.mailingPages.letter });
    await letter.click();
    await userEvent.keyboard("{Control>}{End}{/Control} Hello again.");
    await vi.waitFor(() => expect(actions.save).toHaveBeenCalled(), WAIT);
    const [, , changes] = actions.save.mock.calls[0] as unknown as [number, number, { body: unknown }];
    expect(JSON.stringify(changes.body)).toContain("Hello again.");
    await expect.element(preview().getByText("Hello again.", { exact: false })).toBeVisible();
  });

  it("won't publish without a subject, and says so", async () => {
    await renderWriter({ draft: { ...exampleCampaignDraft, subject: "" } });
    await expect.element(publish()).toBeDisabled();
    await expect.element(page.getByText(copy.refusals["no-subject"])).toBeVisible();
  });

  it("says why publishing was refused: someone else published it, or saved it since", async () => {
    await renderWriter(
      {},
      fakeActions(() => ({ ok: false, reason: "not-draft" })),
    );
    await publish().click();
    await expect.element(page.getByText(copy.refusals["not-draft"])).toBeVisible();
  });

  it("says the draft has changed elsewhere, when publishing finds it saved since", async () => {
    await renderWriter(
      {},
      fakeActions(() => ({ ok: false, reason: "conflict" })),
    );
    await publish().click();
    await expect.element(page.getByText(mailingsCopy.mailingPages.saveStates.conflict)).toBeVisible();
    await expect.element(publish()).toBeDisabled();
  });
});
