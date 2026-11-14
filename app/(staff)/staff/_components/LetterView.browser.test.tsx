import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import LetterView from "./LetterView";
import { examplePauseaiLetterDetails, exampleSupporterLetterDetails } from "./LettersTable.examples";
import { examplePolitician } from "./politicians/PoliticianTable.examples";
import { politiciansCopy } from "./politicians/copy";
import { exampleAsks } from "./asks/AsksList.examples";
import { mailingsCopy } from "./mailings/copy";

const states = mailingsCopy.copyStates;
const noAction = async () => {};

describe("LetterView", () => {
  const letter = { ...examplePauseaiLetterDetails, mailingAsk: exampleAsks[0]!.slug };
  const politician = { ...examplePolitician, airtableId: null };
  const view = (props: Partial<Parameters<typeof LetterView>[0]>) =>
    render(
      <LetterView letter={letter} politician={politician} asks={exampleAsks} setStatus={noAction} {...props}>
        <p>the thread</p>
      </LetterView>,
    );

  it("answered: green, in place of how it went, with the ask as the politician's page has it, beside the thread and history", async () => {
    await view({});
    await expect.element(page.getByText(states.tags.answered!, { exact: true })).toBeVisible();
    await expect.element(page.getByRole("group", { name: exampleAsks[0]!.title })).toBeVisible();
    await expect.element(page.getByText("the thread")).toBeVisible();
    await expect.element(page.getByRole("heading", { name: staffCopy.letters.detail.historyTitle })).toBeVisible();
    await expect.element(page.getByText(mailingsCopy.mailings.personalised, { exact: false })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: letter.mpName }))
      .toHaveAttribute("href", `/staff/politicians/${letter.politicianId}`);
  });

  it("not answered, with no ask: how it went, as a mailing's list says it", async () => {
    const { rerender } = await view({
      letter: { ...letter, mailingAsk: null, status: "bounced", personalised: false },
    });
    await expect.element(page.getByText(states.tags["unreached:bounced"]!, { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("heading", { name: mailingsCopy.mailings.fields.ask, exact: true }))
      .not.toBeInTheDocument();
    const shows = (one: Partial<typeof letter>) =>
      rerender(
        <LetterView
          letter={{ ...letter, ...one }}
          politician={{ ...politician, statuses: {} }}
          asks={exampleAsks}
          setStatus={noAction}
        >
          <p>the thread</p>
        </LetterView>,
      );
    await shows({ status: "spam_complaint" });
    await expect.element(page.getByText(states.tags.spam!, { exact: true })).toBeVisible();
    // Gmail refused it, as it sends a mailing's letters; one copied from Airtable, not said what refused it.
    await shows({ status: "not_sent", backend: null });
    await expect.element(page.getByText(states.tags["error:gmail"]!, { exact: true })).toBeVisible();
    await shows({ status: "not_sent", backend: "airtable" });
    await expect.element(page.getByText(states.tags.error!, { exact: true })).toBeVisible();
    // Skipped, with why, though replied to.
    await shows({ status: "skipped", skipReason: "no-email", repliedAt: new Date("2026-10-02T09:00:00Z") });
    await expect.element(page.getByText(states.tags["not-sent:no-email"]!, { exact: true })).toBeVisible();
  });

  it("a supporter's: its campaign over its ask, tagged when it's to a test politician", async () => {
    const supporters = { ...exampleSupporterLetterDetails, campaignAsk: exampleAsks[0]!.slug };
    await view({ letter: supporters, politician: { ...politician, isTest: true } });
    await expect
      .element(page.getByRole("heading", { level: 1 }))
      .toHaveTextContent(staffCopy.letters.oneTitle(supporters.senderName, supporters.mpName));
    // It bounced, so says so, though the politician answered.
    await expect.element(page.getByText(states.tags["unreached:bounced"]!, { exact: true })).toBeVisible();
    await expect.element(page.getByText(politiciansCopy.politicians.flags.test, { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("heading", { name: mailingsCopy.mailings.fields.ask, exact: true }))
      .toBeVisible();
    // Under the ask, the campaign it's based on.
    await expect.element(page.getByRole("group", { name: exampleAsks[0]!.title })).toBeVisible();
    const campaign = page.getByRole("link", { name: supporters.campaignTitle }).last();
    await expect.element(campaign).toBeVisible();
    const basedOn = campaign.element().closest("p")!;
    expect(basedOn.textContent).toBe(`${staffCopy.letters.detail.basedOn} ${supporters.campaignTitle}`);
    expect(
      page.getByRole("group").element().compareDocumentPosition(basedOn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain(mailingsCopy.mailings.personalised);
  });

  it("a supporter's whose campaign makes no ask: the card is the campaign alone", async () => {
    await view({ letter: exampleSupporterLetterDetails });
    await expect
      .element(page.getByRole("heading", { name: staffCopy.letters.columns.campaign, exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("link", { name: exampleSupporterLetterDetails.campaignTitle }).last())
      .toBeVisible();
    expect(page.getByRole("group").all()).toHaveLength(0);
    await expect.element(page.getByText(staffCopy.letters.status.bounced, { exact: true }).first()).toBeVisible();
    expect(page.getByText(politiciansCopy.politicians.flags.test, { exact: true }).all()).toHaveLength(0);
  });
});
