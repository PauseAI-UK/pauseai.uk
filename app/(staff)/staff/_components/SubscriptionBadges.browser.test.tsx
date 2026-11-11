import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import SubscriptionBadges from "./SubscriptionBadges";
import { exampleBlockedPermissions, exampleSupporterRows } from "./SupportersTable.examples";

describe("SubscriptionBadges", () => {
  const copy = staffCopy.supporters.subscriptions;

  it("shows each consent any of their addresses or numbers says yes to, and nothing for a no", async () => {
    const { rerender } = await render(<SubscriptionBadges permissions={exampleSupporterRows[0].permissions} />);
    expect(document.body.textContent!.trim()).toBe(copy.consents["email:newsletter"]);
    await rerender(<SubscriptionBadges permissions={exampleSupporterRows[1].permissions} />);
    for (const consent of ["email:newsletter", "email:events", "text:volunteering"] as const) {
      await expect.element(page.getByText(copy.consents[consent], { exact: true })).toBeVisible();
    }
    await rerender(<SubscriptionBadges permissions={[]} />);
    expect(document.body.textContent!.trim()).toBe("");
  });

  it("takes a yes at any of their addresses, and shows nothing for one that's blocked", async () => {
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
    expect(document.body.textContent!.trim()).toBe(copy.consents["email:events"]);
    await rerender(<SubscriptionBadges permissions={exampleBlockedPermissions} />);
    expect(document.body.textContent!.trim()).toBe("");
  });
});
