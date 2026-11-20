import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { staffTime } from "@/lib/staff-time";
import ReplyReactions from "./ReplyReactions";
import { ReplyReactionsExample } from "./ReplyReactions.gallery.client";
import { exampleTextReactions } from "./BroadcastWriter.examples";

const copy = broadcastsCopy.broadcastPages.replies;
const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");
/** What Jo's 👍 says under the emoji. */
const ours = copy.ourReaction("👍", "jo@pauseai.uk", staffTime(exampleTextReactions[1].sentAt));
const emoji = (name: string) => page.getByRole("group", { name: copy.react }).getByRole("button", { name });

describe("ReplyReactions", () => {
  it("offers each emoji, none pressed, and puts the one pressed on their message", async () => {
    await render(<ReplyReactionsExample />);
    for (const name of ["👍", "❤️", "🙏"]) await expect.element(emoji(name)).toHaveAttribute("aria-pressed", "false");
    await emoji("🙏").click();
    await expect.element(log()).toHaveTextContent('react(12, "🙏")');
  });

  it("presses ours, says who put it there and when, takes it away when pressed, and puts another in its place", async () => {
    await render(<ReplyReactionsExample reacted />);
    await expect.element(emoji("👍")).toHaveAttribute("aria-pressed", "true");
    await expect.element(emoji("❤️")).toHaveAttribute("aria-pressed", "false");
    await expect.element(page.getByText(ours)).toBeVisible();
    await emoji("👍").click();
    await expect.element(log().last()).toHaveTextContent('react(12, "")');
    await emoji("❤️").click();
    await expect.element(log().last()).toHaveTextContent('react(12, "❤️")');
  });

  it("says when WhatsApp couldn't deliver ours, and when one didn't go", async () => {
    const { unmount } = await render(<ReplyReactionsExample undelivered />);
    await expect.element(page.getByText(copy.undelivered("Parameter value is not valid"))).toBeVisible();
    await unmount();
    await render(<ReplyReactionsExample refused />);
    await emoji("👍").click();
    await expect.element(page.getByText(copy.reactionNotSent)).toBeVisible();
  });

  it("shows only ours on a message too old for another, or with nothing to put one there, and nothing with none", async () => {
    const { unmount } = await render(<ReplyReactionsExample reacted tooOld />);
    await expect.element(page.getByRole("group", { name: copy.react })).not.toBeInTheDocument();
    await expect.element(page.getByText(ours)).toBeVisible();
    await unmount();
    const second = await render(<ReplyReactions replyId={12} reactions={exampleTextReactions} reactable />);
    await expect.element(page.getByRole("group", { name: copy.react })).not.toBeInTheDocument();
    await second.unmount();
    const { container } = await render(<ReplyReactions replyId={12} reactions={[]} reactable={false} />);
    expect(container.textContent).toBe("");
  });
});
