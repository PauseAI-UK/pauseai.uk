import { campaigns } from "@/lib/content/email-your-mp";
import type { CampaignSummary } from "@/lib/mailings/campaigns.server";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import CampaignView from "./CampaignView";
import {
  exampleChanged,
  exampleCampaign,
  exampleCampaignEmpty,
  exampleCampaignNoAsk,
  exampleVersions,
} from "./CampaignPages.examples";
import { emptyLettersSearch, exampleLetter } from "../letters/LettersTable.examples";
import { asksCopy } from "@/lib/asks/copy";
import { mailingsCopy } from "./copy";
import { lettersCopy } from "../letters/copy";

const copy = mailingsCopy.campaigns;
const NOW = "2026-11-05T09:00:00Z";
const link = (name: string) => page.getByRole("link", { name, exact: true });
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("CampaignView's public page", () => {
  const view = (campaign: CampaignSummary) => (
    <CampaignView
      campaign={campaign}
      versions={exampleVersions}
      changed={0}
      letters={{ letters: [], total: 0, pages: 1, pageSize: 100 }}
      search={emptyLettersSearch}
    />
  );

  it("leads to the campaign on the site, else where its letter is kept, else says there's none", async () => {
    const see = () => page.getByRole("link", { name: mailingsCopy.campaigns.seePublicPage });
    const code = campaigns[0];
    const { rerender } = await render(view({ ...exampleCampaign, slug: code.slug }));
    await expect.element(see()).toHaveAttribute("href", `/campaigns/${code.slug}`);
    await rerender(view({ ...exampleCampaign, slug: "gone", url: "https://example.org/letter.pdf" }));
    await expect.element(see()).toHaveAttribute("href", "https://example.org/letter.pdf");
    await rerender(view({ ...exampleCampaign, slug: "gone", url: null }));
    expect(see().query()).toBeNull();
  });
});

describe("CampaignView", () => {
  const letters = [
    exampleLetter,
    { ...exampleLetter, id: 2, status: "sent", answer: "signed" as const, constituency: null, party: "" },
    { ...exampleLetter, id: 3, status: "sent", repliedAt: new Date(NOW), ownWords: null, supporterId: null },
    { ...exampleLetter, id: 4, status: "sent", autoRepliedAt: new Date(NOW) },
    { ...exampleLetter, id: 5, status: "not_sent", backend: "postmark" as const },
    { ...exampleLetter, id: 6, status: "not_sent", backend: "airtable" as const },
  ];
  const view = (campaign = exampleCampaign, search = emptyLettersSearch) => (
    <CampaignView
      campaign={campaign}
      versions={exampleVersions}
      changed={exampleChanged}
      letters={{ letters, total: 150, pages: 2, pageSize: 100 }}
      search={search}
    />
  );

  it("says who it's from and to, its ask and how many answered, with its letters", async () => {
    await render(view());
    await expect.element(page.getByRole("heading", { level: 1 })).toHaveTextContent(exampleCampaign.title);
    await says(copy.supporters(10));
    await says(staffVocabulary.politicians(9));
    await says(mailingsCopy.mailingPages.answeredBar(3, 9));
    await expect.element(link(exampleCampaign.askTitle!)).toHaveAttribute("href", `/staff/asks/${exampleCampaign.ask}`);
    await says(staffVocabulary.statuses.signed);
    // Each letter's one tag: answered in place of sent; what refused one, where that's known.
    const tags = lettersCopy.copyStates.tags;
    await says(tags["unreached:bounced"]!);
    await says(tags.answered!);
    await says(tags.replied!);
    await says(tags["error:postmark"]!);
    await expect.element(page.getByText(tags.error!, { exact: true })).toBeVisible();
    // One only an automatic reply came back to, which is no reply.
    await says(tags["sent:auto-reply"]!);
    // The counts in two groups, each under its total.
    await expect.element(page.getByRole("group", { name: `11 ${lettersCopy.copyStates.groups.went}` })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: `1 ${lettersCopy.copyStates.counts.unreached}` }))
      .toHaveAttribute("href", `/staff/campaigns/${exampleCampaign.slug}?tab=unreached`);
    await expect
      .element(page.getByRole("link", { name: copy.changedLink(exampleChanged) }))
      .toHaveAttribute("href", `/staff/campaigns/${exampleCampaign.slug}?tab=changed`);
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.next }))
      .toHaveAttribute("href", `/staff/campaigns/${exampleCampaign.slug}?page=2`);
  });

  it("with no ask, says so, with no bar and no answers", async () => {
    const { unmount } = await render(view(exampleCampaignNoAsk));
    expect(document.body.textContent).toContain(asksCopy.asks.noAsk);
    expect(document.querySelector("progress")).toBeNull();
    await expect.element(page.getByText(lettersCopy.copyStates.counts.answered!)).not.toBeInTheDocument();
    await unmount();
    // A count chosen heads the letters, and pressed again shows them all; so does the changed wording.
    const { unmount: again } = await render(
      view(exampleCampaignNoAsk, { ...emptyLettersSearch, tab: "replied", page: "2" }),
    );
    await expect.element(page.getByRole("heading", { name: lettersCopy.copyStates.tabs.replied })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: `2 ${lettersCopy.copyStates.counts.replied}` }))
      .toHaveAttribute("title", copy.showAll);
    await expect.element(page.getByRole("link", { name: staffVocabulary.paging.previous })).toBeVisible();
    await again();
    await render(view(exampleCampaignEmpty, { ...emptyLettersSearch, tab: "changed" }));
    await expect.element(page.getByRole("heading", { name: copy.tabs.changed })).toBeVisible();
  });
});
