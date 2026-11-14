import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import CampaignsOverview, { CampaignAsk, letterRange } from "./CampaignsOverview";
import { exampleCampaign, exampleCampaignEmpty, exampleCampaignNoAsk } from "./CampaignPages.examples";
import { asksCopy } from "@/lib/asks/copy";
import { mailingsCopy } from "./copy";
import { lettersCopy } from "../letters/copy";

const copy = mailingsCopy.campaigns;
const NOW = "2026-11-05T09:00:00Z";
const link = (name: string) => page.getByRole("link", { name, exact: true });
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("CampaignsOverview", () => {
  it("files each under the month of its last letter, the rest under their years, those with none first, saying who it's from and its ask", async () => {
    await render(
      <CampaignsOverview campaigns={[exampleCampaign, exampleCampaignNoAsk, exampleCampaignEmpty]} now={NOW} />,
    );
    // What needs a look, leading to its letters, and the rest folded behind how many are fine.
    expect(document.querySelector(`a[href="/staff/campaigns/${exampleCampaign.slug}?tab=unreached"]`)).not.toBeNull();
    expect(document.body.textContent).toContain(lettersCopy.copyStates.andFine(11));
    expect(document.body.textContent).toContain(lettersCopy.copyStates.allFine(12));
    // How many went, after a dot: all but the one that bounced; nothing for one with no letters, which says so.
    expect(document.body.textContent).toContain(copy.sent(11));
    expect(document.body.textContent).not.toContain(copy.sent(0));
    const headings = page
      .getByRole("heading", { level: 2 })
      .all()
      .map((h) => h.element().textContent);
    expect(headings).toEqual(["October 2026", "2025"]);
    await expect
      .element(link(exampleCampaign.title))
      .toHaveAttribute("href", `/staff/campaigns/${exampleCampaign.slug}`);
    await expect.element(link(exampleCampaign.askTitle!)).toHaveAttribute("href", `/staff/asks/${exampleCampaign.ask}`);
    expect(document.body.textContent).toContain(`${copy.fromSupporters} · ${copy.lettersTo(12, 9)}`);
    expect(document.body.textContent).toContain("18 Jun – 22 Oct");
    expect(document.body.textContent).toContain("20 May – 17 Jun 2025");
    // Those with no letters come first, under no month.
    expect(document.querySelector("li")!.textContent).toContain(copy.noLetters);
    expect(document.body.textContent).toContain(asksCopy.asks.noAsk);
  });

  it("says there are none", async () => {
    await render(<CampaignsOverview campaigns={[]} now={NOW} />);
    await says(copy.none);
  });

  it("gives letters' days as a range, a year only once, and one day alone", () => {
    expect(letterRange(new Date("2026-11-01T09:00:00Z"), new Date("2026-11-05T09:00:00Z"), "2026")).toBe(
      "1 Nov – 5 Nov",
    );
    expect(letterRange(new Date("2026-11-05T09:00:00Z"), new Date("2026-11-05T10:00:00Z"), "2026")).toBe("5 Nov");
    expect(letterRange(new Date("2025-07-23T09:00:00Z"), new Date("2025-09-30T09:00:00Z"), "2026")).toBe(
      "23 Jul – 30 Sept 2025",
    );
    expect(letterRange(new Date("2025-12-01T09:00:00Z"), new Date("2026-01-05T09:00:00Z"), "2026")).toBe(
      "1 Dec 2025 – 5 Jan",
    );
    expect(letterRange(new Date("2025-07-23T09:00:00Z"), new Date("2025-07-23T09:00:00Z"), "2026")).toBe("23 Jul 2025");
  });

  it("says an ask by its kind", async () => {
    const { rerender } = await render(<CampaignAsk campaign={exampleCampaign} />);
    expect(document.body.textContent).toContain(asksCopy.asks.askTo.letter);
    await rerender(<CampaignAsk campaign={{ ...exampleCampaign, askKind: "event" }} />);
    expect(document.body.textContent).toContain(asksCopy.asks.askTo.event);
  });
});
