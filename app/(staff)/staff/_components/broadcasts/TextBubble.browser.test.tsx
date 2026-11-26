import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import { exampleLinkCard, examplePictureId, examplePlace, exampleWhatsAppWords } from "./BroadcastWriter.examples";
import { textBubbleGallery } from "./TextBubble.gallery";
import TextBubble, { ChatBubble, LinkedText, type TextDoc } from "./TextBubble";
import type { LinkCard } from "@/lib/broadcasts/link-card";
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
    await render(<TextBubble words={exampleWhatsAppWords} footer={TEMPLATE_FOOTER} time="07:18" />);
    const bubble = page.getByText("07:18").element().parentElement!;
    expect(bubble.querySelector("strong")?.textContent).toBe("11:00");
    expect(bubble.querySelector("strong em")?.textContent).toBe("Parliament Square");
    expect([...bubble.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Bring water", "Wear orange"]);
    expect(bubble.querySelector("blockquote")?.textContent).toBe("Pause AI now.");
    expect(bubble.querySelector("br")).not.toBeNull();
    expect([...bubble.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["https://pauseai.uk/march"]);
    expect(bubble.textContent).not.toMatch(/[>*_]/);
  });
});

describe("TextBubble's card and fold", () => {
  const paragraphs = (...texts: string[]): TextDoc => ({
    content: texts.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  });
  const bubble = (words: TextDoc, card?: LinkCard | null) => (
    <TextBubble words={words} card={card} footer={TEMPLATE_FOOTER} time="07:18" />
  );
  const readMore = () => page.getByRole("button", { name: broadcastsCopy.broadcastPages.readMore });

  it("shows the card for its link above its words: the title, a line of description, the site", async () => {
    await render(bubble(paragraphs("Details: https://pauseai.uk/march"), exampleLinkCard));
    await expect.element(page.getByText(exampleLinkCard.title)).toBeVisible();
    await expect.element(page.getByText(exampleLinkCard.description)).toBeVisible();
    await expect.element(page.getByText(exampleLinkCard.site, { exact: true })).toBeVisible();
  });

  it("shows a place's map in place of its link's card, with the place's name and address", async () => {
    await render(
      <TextBubble
        words={paragraphs("Details: https://pauseai.uk/march")}
        card={exampleLinkCard}
        place={examplePlace}
        footer={TEMPLATE_FOOTER}
        time="07:18"
      />,
    );
    await expect.element(page.getByText(examplePlace.name, { exact: true })).toBeVisible();
    await expect.element(page.getByText(examplePlace.address)).toBeVisible();
    expect(document.querySelector("svg[aria-hidden=true]")).not.toBeNull();
    expect(page.getByText(exampleLinkCard.title).query()).toBeNull();
  });

  it("shows a picture at its top, above its words, in place of a place's map or its link's card", async () => {
    await render(
      <TextBubble
        words={paragraphs("Details: https://pauseai.uk/march")}
        card={exampleLinkCard}
        place={examplePlace}
        picture="/public/images/logos/Pause-Symbol.svg"
        footer={TEMPLATE_FOOTER}
        time="07:18"
      />,
    );
    const bubble = page.getByText("07:18").element().parentElement!;
    const picture = bubble.querySelector("img")!;
    expect(picture.getAttribute("src")).toBe("/public/images/logos/Pause-Symbol.svg");
    expect(picture.alt).toBe("");
    expect(bubble.firstElementChild).toBe(picture);
    expect(page.getByText(examplePlace.name, { exact: true }).query()).toBeNull();
    expect(page.getByText(exampleLinkCard.title).query()).toBeNull();
    await expect.element(page.getByText(/^Details:/)).toBeVisible();
  });

  it("has its reply buttons under it, each a line, and none when it has none", async () => {
    const { rerender } = await render(
      <TextBubble words={paragraphs("Coming?")} buttons={["Yes", "No"]} footer={TEMPLATE_FOOTER} time="07:18" />,
    );
    const list = page.getByRole("list");
    expect([...list.element().querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Yes", "No"]);
    // Under the bubble, not in it.
    expect(page.getByText("07:18").element().parentElement!.contains(list.element())).toBe(false);
    await rerender(<TextBubble words={paragraphs("Coming?")} footer={TEMPLATE_FOOTER} time="07:18" />);
    expect(page.getByRole("list").query()).toBeNull();
  });

  it("shows words that fit whole, with no card and no Read more", async () => {
    await render(bubble(paragraphs("One", "Two", "Three"), null));
    await expect.element(page.getByText("Three")).toBeVisible();
    expect(readMore().query()).toBeNull();
  });

  it("folds at five lines, a blank line between paragraphs counting as one, and Read more opens the rest", async () => {
    await render(bubble(paragraphs("One", "Two", "Three", "Four")));
    const words = page.getByText("One").element().parentElement!;
    const line = parseFloat(getComputedStyle(words).lineHeight);
    // One, a blank, Two, a blank, Three: the fold; Four under it.
    expect(words.clientHeight).toBeCloseTo(5 * line, 0);
    await expect.element(readMore()).toBeVisible();
    await readMore().click();
    await expect.element(readMore()).not.toBeInTheDocument();
    expect(words.clientHeight).toBeCloseTo(7 * line, 0);
  });

  it("stays open as its card comes, and folds again once its words change", async () => {
    const { rerender } = await render(bubble(paragraphs("One", "Two", "Three", "Four")));
    await readMore().click();
    await rerender(bubble(paragraphs("One", "Two", "Three", "Four"), exampleLinkCard));
    await expect.element(page.getByText(exampleLinkCard.title)).toBeVisible();
    expect(readMore().query()).toBeNull();
    await rerender(bubble(paragraphs("One", "Two", "Three", "Four", "Five"), exampleLinkCard));
    await expect.element(readMore()).toBeVisible();
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

describe("BubbleTop's examples, and a bubble's with buttons, in the gallery", () => {
  it("draws a map and a picture at a bubble's top, and buttons under one", async () => {
    const variants = textBubbleGallery
      .filter((example) => ["BubbleTop", "TextWords"].includes(example.name))
      .flatMap((example) => example.variants);
    await render(
      <>
        {variants.map((variant) => (
          <div key={variant.label}>{variant.render()}</div>
        ))}
      </>,
    );
    await expect.element(page.getByText(examplePlace.address)).toBeVisible();
    expect(document.querySelector("img")!.getAttribute("src")).toBe(examplePictureId);
    expect(
      [...page.getByRole("list").filter({ hasText: "I'm coming" }).element().querySelectorAll("li")].map(
        (li) => li.textContent,
      ),
    ).toEqual(["I'm coming", "Can't make it"]);
  });
});
