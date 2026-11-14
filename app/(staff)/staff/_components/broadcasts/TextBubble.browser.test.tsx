import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import { exampleWhatsAppWords } from "./BroadcastWriter.examples";
import TextBubble, { ChatBubble, LinkedText } from "./TextBubble";

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
});
