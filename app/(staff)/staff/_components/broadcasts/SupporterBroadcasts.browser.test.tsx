import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import SupporterBroadcasts from "./SupporterBroadcasts";
import { broadcastsCopy } from "@/lib/broadcasts/copy";

const copy = broadcastsCopy.broadcastPages;

describe("SupporterBroadcasts", () => {
  it("lists those they were sent, leading to each", async () => {
    await render(
      <SupporterBroadcasts
        broadcasts={[
          {
            copyId: 21,
            messageId: 5,
            title: "March day",
            channel: "text",
            status: "delivered",
            skipReason: null,
            sentAt: new Date("2026-11-07T07:18:00Z"),
            state: "read",
            why: null,
          },
          {
            copyId: 22,
            messageId: 6,
            title: "",
            channel: "email",
            status: "failed",
            skipReason: null,
            sentAt: null,
            state: "error",
            why: "gmail",
          },
          {
            copyId: 23,
            messageId: 7,
            title: "Stopped",
            channel: "email",
            status: "cancelled",
            skipReason: null,
            sentAt: null,
            state: "not-sent",
            why: "cancelled",
          },
        ]}
      />,
    );
    await expect.element(page.getByRole("link", { name: "March day" })).toHaveAttribute("href", "/staff/broadcasts/5");
    await expect
      .element(page.getByRole("link", { name: copy.threadLink }).first())
      .toHaveAttribute("href", "/staff/broadcasts/5/21");
    // One went to each of the two that went; the one stopped has no page of its own.
    await expect.poll(() => page.getByRole("link", { name: copy.threadLink }).elements().length).toBe(2);
    await expect.element(page.getByRole("link", { name: copy.untitled })).toBeVisible();
  });

  it("says when there are none", async () => {
    await render(<SupporterBroadcasts broadcasts={[]} />);
    await expect.element(page.getByText(copy.supporterNone)).toBeVisible();
  });
});
