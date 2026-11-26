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

  it("shows a picture at its top, above its words, in place of a place's map, its link's small card under it", async () => {
    const withPicture = (card: LinkCard | null) => (
      <TextBubble
        words={paragraphs("Details: https://pauseai.uk/march")}
        card={card}
        place={examplePlace}
        picture="/public/images/logos/Pause-Symbol.svg"
        footer={TEMPLATE_FOOTER}
        time="07:18"
      />
    );
    const { rerender } = await render(withPicture(exampleLinkCard));
    const bubble = page.getByText("07:18").element().parentElement!;
    const picture = bubble.querySelector("img")!;
    expect(picture.getAttribute("src")).toBe("/public/images/logos/Pause-Symbol.svg");
    expect(picture.alt).toBe("");
    expect(bubble.firstElementChild!.firstElementChild).toBe(picture);
    expect(page.getByText(examplePlace.name, { exact: true }).query()).toBeNull();
    // The small card: the site's name and its site, under the picture; not the page's title or description.
    const name = page.getByText(exampleLinkCard.name, { exact: true }).element();
    expect(bubble.firstElementChild!.contains(name)).toBe(true);
    expect(picture.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await expect.element(page.getByText(exampleLinkCard.site, { exact: true })).toBeVisible();
    expect(page.getByText(exampleLinkCard.title).query()).toBeNull();
    expect(page.getByText(exampleLinkCard.description).query()).toBeNull();
    await expect.element(page.getByText(/^Details:/)).toBeVisible();
    // With no card, the picture alone.
    await rerender(withPicture(null));
    expect(page.getByText(exampleLinkCard.name, { exact: true }).query()).toBeNull();
    expect(bubble.firstElementChild!.children).toHaveLength(1);
  });

  it("has its buttons at its foot, in it, each with a reply's icon or a link's, and none when it has none", async () => {
    const { rerender } = await render(
      <TextBubble
        words={paragraphs("Coming?")}
        buttons={[{ text: "Yes" }, { text: "No" }, { text: "Sign up", url: "https://pauseai.uk/march" }]}
        footer={TEMPLATE_FOOTER}
        time="07:18"
      />,
    );
    const list = page.getByRole("list");
    const items = [...list.element().querySelectorAll("li")];
    expect(items.map((li) => li.textContent)).toEqual(["Yes", "No", "Sign up"]);
    // In the bubble, after its time.
    const time = page.getByText("07:18").element();
    expect(time.parentElement!.contains(list.element())).toBe(true);
    expect(time.compareDocumentPosition(list.element()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const icon = (li: Element) => li.querySelector("svg")!.innerHTML;
    expect(icon(items[1])).toBe(icon(items[0]));
    expect(icon(items[2])).not.toBe(icon(items[0]));
    await rerender(<TextBubble words={paragraphs("Coming?")} footer={TEMPLATE_FOOTER} time="07:18" />);
    expect(page.getByRole("list").query()).toBeNull();
  });

  it("has no footer where it isn't known", async () => {
    await render(<TextBubble words={paragraphs("Coming?")} footer={null} time="07:18" />);
    expect(page.getByText(TEMPLATE_FOOTER).query()).toBeNull();
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

describe("A text's examples in the gallery", () => {
  it("draws its top, the card WhatsApp shows with it, and its buttons, in a phone's bubble and one of our own", async () => {
    const variants = textBubbleGallery
      .filter((example) => ["TextBubble", "TextMessage", "TextWords"].includes(example.name))
      .flatMap((example) => example.variants);
    await render(
      <>
        {variants.map((variant) => (
          <div key={variant.label}>{variant.render()}</div>
        ))}
      </>,
    );
    // The map's, with no card; the whole card with no header; the small one under each picture.
    await expect.element(page.getByText(examplePlace.address)).toBeVisible();
    expect(page.getByText(exampleLinkCard.title).elements()).toHaveLength(1);
    expect(page.getByText(exampleLinkCard.site, { exact: true }).elements()).toHaveLength(3);
    expect([...document.querySelectorAll("img")].map((img) => img.getAttribute("src"))).toEqual([
      examplePictureId,
      examplePictureId,
    ]);
    expect(page.getByText("I'm coming").elements()).toHaveLength(2);
    expect(page.getByText("Sign up").elements()).toHaveLength(3);
  });
});
