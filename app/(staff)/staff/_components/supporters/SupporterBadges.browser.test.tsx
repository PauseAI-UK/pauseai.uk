import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import StaffPage from "../ui/StaffPage";
import SupporterBadges from "./SupporterBadges";
import { exampleMemberDetails, exampleSupporter } from "./SupportersTable.examples";
import { supportersCopy } from "./copy";

describe("SupporterBadges", () => {
  it("shows what the supporter is to us, and nothing for someone who is nothing yet", async () => {
    const { rerender } = await render(<SupporterBadges supporter={exampleSupporter} />);
    await expect.element(page.getByText(supportersCopy.supporters.badges.lumaContact)).toBeVisible();
    await expect.element(page.getByText(supportersCopy.supporters.badges.registered)).toBeVisible();
    await expect.element(page.getByText(supportersCopy.supporters.badges.letter)).toBeVisible();
    await rerender(<SupporterBadges supporter={{ ...exampleSupporter, lumaContact: false, events: 0, letters: 0 }} />);
    expect(document.body.textContent!.trim()).toBe("");
  });

  it("marks a march sign-up, a paper sign-up and a WhatsApp member", async () => {
    await render(
      <SupporterBadges
        supporter={{ ...exampleSupporter, sources: ["march-2026-11", "paper-signup", "whatsapp-community"] }}
      />,
    );
    await expect.element(page.getByText(supportersCopy.supporters.badges.march)).toBeVisible();
    await expect.element(page.getByText(supportersCopy.supporters.badges.paper)).toBeVisible();
    await expect.element(page.getByText(supportersCopy.supporters.badges.whatsapp, { exact: true })).toBeVisible();
  });

  it("marks a sign-up for the next march as it does the last's", async () => {
    await render(<SupporterBadges supporter={{ ...exampleSupporter, sources: ["march-2027-04"] }} />);
    await expect.element(page.getByText(supportersCopy.supporters.badges.march)).toBeVisible();
  });

  it("is larger on their own page than in the list", async () => {
    const height = () =>
      page.getByText(supportersCopy.supporters.badges.registered).element().getBoundingClientRect().height;
    // On a staff page, whose lozenges are small.
    const view = await render(
      <StaffPage as="div">
        <SupporterBadges supporter={exampleSupporter} />
      </StaffPage>,
    );
    const small = height();
    await view.rerender(
      <StaffPage as="div">
        <SupporterBadges supporter={exampleSupporter} large />
      </StaffPage>,
    );
    expect(height()).toBeGreaterThan(small);
  });

  it("marks a member, but not a member no longer", async () => {
    const badges = supportersCopy.supporters.badges;
    const member = exampleMemberDetails.summary;
    const { rerender } = await render(<SupporterBadges supporter={member} />);
    expect(document.body.textContent!.trim()).toBe(badges.member);
    await rerender(<SupporterBadges supporter={{ ...member, member: false }} />);
    expect(document.body.textContent!.trim()).toBe("");
  });
});
