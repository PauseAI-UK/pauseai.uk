import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import { exampleWhatsAppWords } from "./BroadcastWriter.examples";
import TextBubble, { ChatBubble, LinkedText } from "./TextBubble";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import type { Receipt } from "@/lib/broadcasts/receipts";

describe("LinkedText", () => {
  it("makes each web address a link, as WhatsApp does, leaving a sentence's end out of it", async () => {
    await render(
      <p>
        <LinkedText text="Sign up at https://pauseai.uk/join. Or www.example.org, or not at all" />
      </p>,
    );
    await expect
      .element(page.getByRole("link", { name: "https://pauseai.uk/join" }))
      .toHaveAttribute("href", "https://pauseai.uk/join");
    await expect
      .element(page.getByRole("link", { name: "www.example.org" }))
      .toHaveAttribute("href", "https://www.example.org");
    await expect.element(page.getByText(/, or not at all$/)).toBeVisible();
  });
});

describe("TextBubble", () => {
  it("shows a text as WhatsApp does: bold, italic, a list, a quote, web addresses linked and a link's mark not", async () => {
    await render(<TextBubble from="PauseAI UK" words={exampleWhatsAppWords} footer={TEMPLATE_FOOTER} time="07:18" />);
    const bubble = page.getByText("PauseAI UK").element().parentElement!;
    expect(bubble.querySelector("strong")?.textContent).toBe("11:00");
    expect(bubble.querySelector("strong em")?.textContent).toBe("Parliament Square");
    expect([...bubble.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Bring water", "Wear orange"]);
    expect(bubble.querySelector("blockquote")?.textContent).toBe("Pause AI now.");
    expect(bubble.querySelector("br")).not.toBeNull();
    expect([...bubble.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["https://pauseai.uk/march"]);
    expect(bubble.textContent).not.toMatch(/[>*_]/);
  });
});

describe("ChatBubble", () => {
  it("names ours, at the right, apart from theirs", async () => {
    await render(
      <>
        <ChatBubble who="Answer" when="now" ours>
          Yes
        </ChatBubble>
        <ChatBubble who="Theirs" when="now">
          Hi
        </ChatBubble>
      </>,
    );
    const colour = (who: string) => getComputedStyle(page.getByText(who).element()).color;
    expect(colour("Theirs")).not.toBe(colour("Answer"));
  });

  it("ticks ours after its time as WhatsApp does: one sent, two delivered, two blue read; or says why it failed", async () => {
    const events = broadcastsCopy.broadcastPages.events;
    const bubble = (receipt?: Receipt) => (
      <ChatBubble who="Ours" when="07:45" ours receipt={receipt}>
        Yes
      </ChatBubble>
    );
    const { rerender } = await render(bubble());
    await expect.element(page.getByText("07:45", { exact: true })).toBeVisible();
    expect(page.getByRole("img").elements()).toEqual([]);
    const ticks = () => page.getByRole("img").element().querySelectorAll("path").length;
    const colour = () => getComputedStyle(page.getByRole("img").element()).color;
    await rerender(bubble({ kind: "sent" }));
    await expect.element(page.getByRole("img", { name: events.sent })).toBeVisible();
    expect(ticks()).toBe(1);
    const grey = colour();
    await rerender(bubble({ kind: "delivered" }));
    await expect.element(page.getByRole("img", { name: events.delivered })).toBeVisible();
    expect(ticks()).toBe(2);
    expect(colour()).toBe(grey);
    await rerender(bubble({ kind: "read" }));
    await expect.element(page.getByRole("img", { name: events.read })).toBeVisible();
    expect(colour()).not.toBe(grey);
    await expect.element(page.getByText("07:45", { exact: true })).toBeVisible();
    // Failed: no ticks, but why, under its words.
    await rerender(bubble({ kind: "failed", why: "Re-engagement message" }));
    expect(page.getByRole("img").elements()).toEqual([]);
    await expect
      .element(page.getByText(broadcastsCopy.broadcastPages.replies.undelivered("Re-engagement message")))
      .toBeVisible();
    await rerender(bubble({ kind: "failed", why: null }));
    await expect.element(page.getByText(broadcastsCopy.broadcastPages.replies.undelivered(null))).toBeVisible();
  });
});
