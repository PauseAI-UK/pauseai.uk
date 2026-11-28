import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import type { FormResult } from "@/lib/form-result";
import NewCampaignWriter, { type NewCampaignRefusal } from "./NewCampaignWriter";
import {
  exampleAsks,
  exampleCampaignConditions,
  exampleCampaignDraft,
  exampleMps,
} from "./CampaignLetterWriter.examples";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.newCampaign;

type Create = (form: FormData) => Promise<FormResult<NewCampaignRefusal>>;

async function renderWriter(create = vi.fn<Create>(async () => ({ ok: true }))) {
  await render(
    <NewCampaignWriter
      start={{ subject: "", body: exampleCampaignDraft.body }}
      mps={exampleMps}
      asks={exampleAsks}
      conditions={exampleCampaignConditions}
      create={create}
    />,
  );
  return create;
}

const make = () => page.getByRole("button", { name: copy.make });

describe("NewCampaignWriter", () => {
  it("sends the title, the ask and the letter as it's written, with the preview beside it", async () => {
    const create = await renderWriter();
    await userEvent.fill(page.getByLabelText(copy.title), "Stop the race");
    await userEvent.selectOptions(page.getByLabelText(mailingsCopy.mailingPages.ask), exampleAsks[0].slug);
    await userEvent.fill(page.getByLabelText(mailingsCopy.mailingPages.subject), "Please act");
    await expect
      .element(page.getByRole("region", { name: mailingsCopy.campaignLetter.preview }).getByText("Please act"))
      .toBeVisible();
    await make().click();
    await vi.waitFor(() => expect(create).toHaveBeenCalled());
    const sent = create.mock.calls[0][0];
    expect(Object.fromEntries(sent)).toEqual({
      title: "Stop the race",
      ask: exampleAsks[0].slug,
      subject: "Please act",
      body: JSON.stringify(exampleCampaignDraft.body),
    });
  });

  it("says why it wasn't made, and marks the title wrong", async () => {
    await renderWriter(vi.fn<Create>(async () => ({ ok: false, reason: "no-title" })));
    await make().click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.refusals["no-title"]);
    await expect.element(page.getByLabelText(copy.title)).toHaveAttribute("aria-invalid", "true");
  });
});
