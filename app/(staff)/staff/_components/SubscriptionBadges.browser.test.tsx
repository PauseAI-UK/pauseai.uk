import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import SubscriptionBadges from "./SubscriptionBadges";
import { exampleBlockedPermissions, exampleSupporterRows } from "./SupportersTable.examples";

describe("SubscriptionBadges", () => {
  const copy = staffCopy.supporters.subscriptions;

  it("shows each topic we'd email them about, amber when we can't be sure, and nothing for a no", async () => {
    const { rerender } = await render(<SubscriptionBadges permissions={exampleSupporterRows[0].permissions} />);
    expect(document.body.textContent!.trim()).toBe(copy.topics.email["site-forms"]);
    await rerender(<SubscriptionBadges permissions={exampleSupporterRows[1].permissions} />);
    await expect.element(page.getByText(copy.topics.email["luma-calendar"], { exact: true })).toBeVisible();
    await expect.element(page.getByText(copy.unsure(copy.topics.email["pauseai-updates"]))).toBeVisible();
    await rerender(<SubscriptionBadges permissions={[]} />);
    expect(document.body.textContent!.trim()).toBe("");
  });

  it("takes the best answer across their addresses, and shows nothing for one that's blocked", async () => {
    const [jane] = exampleSupporterRows[0].permissions;
    const { rerender } = await render(
      <SubscriptionBadges
        permissions={[
          jane,
          { ...jane, address: "jane.e@example.org", send: "yes", reason: "following" },
          ...exampleBlockedPermissions,
        ]}
      />,
    );
    expect(document.body.textContent!.trim()).toBe(copy.topics.email["luma-calendar"]);
    await rerender(<SubscriptionBadges permissions={exampleBlockedPermissions} />);
    expect(document.body.textContent!.trim()).toBe("");
  });
});
