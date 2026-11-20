import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import SubscriptionBadges from "./SubscriptionBadges";
import { exampleBlockedPermissions, exampleSupporterRows } from "./SupportersTable.examples";
import { supportersCopy } from "./copy";

describe("SubscriptionBadges", () => {
  const { lists, ways } = supportersCopy.supporters.filters;
  const { lumaOnly } = supportersCopy.supporters.detail.permissions;
  /** Each lozenge: the names of its ways' icons, then its list. */
  const badges = () =>
    [...document.querySelectorAll("[class*=tag]")].map((tag) => [
      [...tag.querySelectorAll("svg")].map((svg) => svg.getAttribute("aria-label")),
      tag.textContent,
    ]);

  it("shows a lozenge for each list any of their addresses or numbers puts them on, its ways' icons first", async () => {
    const { rerender } = await render(<SubscriptionBadges permissions={exampleSupporterRows[0].permissions} />);
    expect(badges()).toEqual([[[ways.email], lists.updates]]);
    // Sam's yes to events by email is at the address Updates reaches, so it adds no lozenge.
    await rerender(<SubscriptionBadges permissions={exampleSupporterRows[1].permissions} />);
    expect(badges()).toEqual([
      [[ways.email], lists.updates],
      [[ways.text], lists.volunteering],
    ]);
    await rerender(<SubscriptionBadges permissions={[]} />);
    expect(document.body.textContent!.trim()).toBe("");
  });

  it("puts every way a list reaches them by in its one lozenge", async () => {
    const [, , volunteering] = exampleSupporterRows[1].permissions;
    await render(
      <SubscriptionBadges
        permissions={[
          { ...volunteering, way: "email", channel: "email", address: "sam@example.com" },
          volunteering,
          { ...volunteering, way: "call" },
        ]}
      />,
    );
    expect(badges()).toEqual([[[ways.email, ways.text, ways.call], lists.volunteering]]);
    await expect.element(page.getByText(lists.volunteering)).toBeVisible();
  });

  it("takes a yes at any of their addresses, Luma alone's under its own name, and shows nothing for one that's blocked", async () => {
    const [, jane] = exampleSupporterRows[0].permissions;
    const { rerender } = await render(
      <SubscriptionBadges
        permissions={[
          jane,
          { ...jane, address: "jane.e@example.org", send: "yes", reason: "following" },
          ...exampleBlockedPermissions,
        ]}
      />,
    );
    expect(badges()).toEqual([[[ways.email], lumaOnly.name]]);
    await rerender(<SubscriptionBadges permissions={exampleBlockedPermissions} />);
    expect(document.body.textContent!.trim()).toBe("");
  });
});
