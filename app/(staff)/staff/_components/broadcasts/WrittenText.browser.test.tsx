import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import type { WrittenText as Written } from "@/lib/broadcasts/text-shown";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import { examplePictureId, examplePlace, exampleVariant } from "./BroadcastWriter.examples";
import WrittenText from "./WrittenText";
import { writtenTextGallery } from "./WrittenText.gallery";

const words = (text: string) => ({
  type: "doc" as const,
  content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text }] }],
});

/** Everyone's text has a map and a reply button; the version for those who wrote, a picture and a link button. */
const written: Written = {
  body: words("Meet at the square"),
  header: "location",
  place: examplePlace,
  pictureId: null,
  buttons: [{ text: "I'm coming" }],
  variant: null,
  textVersion: {
    condition: "wrote:regulate-ai",
    body: words("Thanks for writing"),
    header: "image",
    place: null,
    pictureId: examplePictureId,
    buttons: [{ text: "Details", url: "https://pauseai.uk/march" }],
    variant: exampleVariant(8, null, { status: "draft", approvedAt: null }),
  },
};

/** Each text shown, in order: its heading's words and whether it has the mark of leaving out, and its words. */
const texts = (container: HTMLElement) =>
  [...container.firstElementChild!.children].map((one) => {
    const heading = one.firstElementChild!;
    return [heading.textContent, heading.querySelector("svg") !== null, one.querySelector("p")!.textContent];
  });

describe("WrittenText", () => {
  it("shows both texts, the version for those who meet its condition first, then everyone else's, each headed by who it's for", async () => {
    const { container } = await render(
      <WrittenText written={written} labels={{ "wrote:regulate-ai": "Wrote to their MP" }} time="07:18" />,
    );
    expect(texts(container)).toEqual([
      ["Wrote to their MP", false, "Thanks for writing"],
      ["Wrote to their MP", true, "Meet at the square"],
    ]);
    // Each with its own top and buttons.
    const [version, everyone] = [...container.firstElementChild!.children];
    expect(version.querySelector("img")!.getAttribute("src")).toBe(examplePictureId);
    expect(version.textContent).not.toContain(examplePlace.address);
    expect(version.querySelector("li")!.textContent).toBe("Details");
    expect(everyone.querySelector("img")).toBeNull();
    expect(everyone.textContent).toContain(examplePlace.address);
    expect(everyone.querySelector("li")!.textContent).toBe("I'm coming");
    expect(everyone.textContent).toContain(TEMPLATE_FOOTER);
    // A heading, not a button.
    expect(container.querySelector("button")).toBeNull();
  });

  it("heads them with the condition's ID where the labels lack it", async () => {
    const { container } = await render(<WrittenText written={written} labels={{}} time="07:18" />);
    expect(texts(container).map(([heading]) => heading)).toEqual(["wrote:regulate-ai", "wrote:regulate-ai"]);
  });

  it("shows just the one text, unheaded, without a second version", async () => {
    await render(<WrittenText written={{ ...written, textVersion: null }} labels={{}} time="07:18" />);
    await expect.element(page.getByText("Meet at the square")).toBeVisible();
    await expect.element(page.getByText("Thanks for writing")).not.toBeInTheDocument();
    await expect.element(page.getByText("wrote:regulate-ai")).not.toBeInTheDocument();
  });
});

describe("WrittenText's examples in the gallery", () => {
  it("draws each", async () => {
    const variants = writtenTextGallery.flatMap((example) => example.variants);
    await render(
      <>
        {variants.map((variant) => (
          <div key={variant.label}>{variant.render()}</div>
        ))}
      </>,
    );
    await expect.element(page.getByText("wrote to their MP").first()).toBeVisible();
  });
});
