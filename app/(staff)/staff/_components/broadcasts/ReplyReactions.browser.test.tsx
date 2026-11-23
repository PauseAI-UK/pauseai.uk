import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { staffTime } from "@/lib/staff-time";
import { ReplyReactionsExample } from "./ReplyReactions.gallery.client";
import { exampleTextReactions } from "./BroadcastWriter.examples";

const copy = broadcastsCopy.broadcastPages.replies;
const log = () => page.getByRole("list", { name: "Event log" }).getByRole("listitem");
/** What Jo's 👍 says under the conversation. */
const ours = copy.reactedBy("👍", "jo@pauseai.uk", staffTime(exampleTextReactions[1].sentAt));
const smiley = () => page.getByRole("button", { name: copy.react });
const emoji = (name: string) => page.getByRole("group", { name: copy.react }).getByRole("button", { name });

describe("ReplyReactions", () => {
  it("opens the emoji from the smiley beside their message, and puts the one pressed on it", async () => {
    await render(<ReplyReactionsExample />);
    await expect.element(page.getByText("Great, thanks!")).toBeVisible();
    await expect.element(smiley()).toHaveAttribute("aria-expanded", "false");
    await expect.element(page.getByRole("group", { name: copy.react })).not.toBeInTheDocument();
    await smiley().click();
    await expect.element(smiley()).toHaveAttribute("aria-expanded", "true");
    for (const name of ["👍", "❤️", "🙏"]) await expect.element(emoji(name)).toHaveAttribute("aria-pressed", "false");
    await emoji("🙏").click();
    await expect.element(log()).toHaveTextContent('react(12, "🙏")');
    // Gone, the emoji close.
    await expect.element(page.getByRole("group", { name: copy.react })).not.toBeInTheDocument();
    // Pressed again, the smiley closes them.
    await smiley().click();
    await smiley().click();
    await expect.element(page.getByRole("group", { name: copy.react })).not.toBeInTheDocument();
  });

  it("puts ours on their bubble, says who put it there and when, takes it away when pressed, and puts another in its place", async () => {
    await render(<ReplyReactionsExample reacted />);
    await expect.element(page.getByText(ours)).toBeVisible();
    await expect.element(page.getByText("👍", { exact: true })).toBeVisible();
    await smiley().click();
    await expect.element(emoji("👍")).toHaveAttribute("aria-pressed", "true");
    await emoji("👍").click();
    await expect.element(log().last()).toHaveTextContent('react(12, "")');
    await smiley().click();
    await emoji("❤️").click();
    await expect.element(log().last()).toHaveTextContent('react(12, "❤️")');
  });

  it("says when WhatsApp couldn't deliver ours, and when one didn't go, leaving the emoji open", async () => {
    const { unmount } = await render(<ReplyReactionsExample undelivered />);
    await expect.element(page.getByText(copy.undelivered("Parameter value is not valid"))).toBeVisible();
    await unmount();
    await render(<ReplyReactionsExample refused />);
    await smiley().click();
    await emoji("👍").click();
    await expect.element(page.getByText(copy.reactionNotSent)).toBeVisible();
    await expect.element(page.getByRole("group", { name: copy.react })).toBeVisible();
  });

  it("opens the emoji to the smiley's right where they fit, and floats them under it where they don't", async () => {
    const { unmount } = await render(<ReplyReactionsExample />);
    await smiley().click();
    await expect.element(page.getByRole("group", { name: copy.react })).toHaveAttribute("data-place", "right");
    await unmount();
    // A conversation too narrow for them beside the smiley.
    await render(
      <div style={{ width: "13rem" }}>
        <ReplyReactionsExample />
      </div>,
    );
    await smiley().click();
    await expect.element(page.getByRole("group", { name: copy.react })).toHaveAttribute("data-place", "under");
    // Closed and opened again, they look for room afresh.
    await smiley().click();
    await smiley().click();
    await expect.element(page.getByRole("group", { name: copy.react })).toHaveAttribute("data-place", "under");
  });

  it("has no smiley on a message too old for another, or not their latest, but still shows ours", async () => {
    const { unmount } = await render(<ReplyReactionsExample reacted tooOld />);
    await expect.element(smiley()).not.toBeInTheDocument();
    await expect.element(page.getByText(ours)).toBeVisible();
    await unmount();
    await render(<ReplyReactionsExample tooOld />);
    await expect.element(smiley()).not.toBeInTheDocument();
    await expect.element(page.getByText("Great, thanks!")).toBeVisible();
  });
});
