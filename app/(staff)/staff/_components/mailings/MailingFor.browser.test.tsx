import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import MailingFor from "./MailingFor";
import { exampleWriterData, exampleWrittenMailing } from "./MailingWriter.examples";
import { exampleMailing } from "./MailingsTable.examples";
import { exampleAsks } from "../asks/AsksList.examples";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.mailingPages;
const noAction = async () => {};

describe("MailingFor", () => {
  const actions = {
    start: vi.fn(),
    save: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    sendTest: vi.fn(),
    schedule: vi.fn(),
    deleteDraft: noAction,
    stop: noAction,
    reschedule: noAction,
  };

  it("shows an imported mailing's recipients, a draft to write, or a mailing scheduled", async () => {
    const { rerender } = await render(
      <MailingFor data={{ kind: "imported", mailing: exampleMailing }} actions={actions} />,
    );
    await expect.element(page.getByText(mailingsCopy.mailings.noText)).toBeVisible();
    await rerender(
      <MailingFor data={{ kind: "draft", draft: exampleWrittenMailing, ...exampleWriterData }} actions={actions} />,
    );
    await expect.element(page.getByRole("textbox", { name: copy.letter })).toBeVisible();
    await rerender(
      <MailingFor
        data={{
          kind: "written",
          mailing: exampleMailing,
          written: { ...exampleWrittenMailing, state: "sent" },
          filter: exampleWriterData.filter,
          parties: [],
          asks: exampleAsks,
          names: {},
        }}
        actions={actions}
      />,
    );
    await expect.element(page.getByText(copy.answeredBar(1, 4))).toBeVisible();
  });
});
