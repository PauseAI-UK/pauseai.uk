import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MailingLetter } from "./MailingLetter";
import { exampleMailingLetter } from "./MailingWriter.examples";
import { mailingsCopy } from "./copy";

describe("MailingLetter", () => {
  it("shows fields as chips by their labels, or their IDs, and a part for only some in a box saying who", async () => {
    await render(
      <MailingLetter
        doc={exampleMailingLetter}
        fields={{ salutation: "Salutation" }}
        conditions={{ "frontier-ai-letter:signed": "signed the letter" }}
      />,
    );
    await expect.element(page.getByText("Salutation", { exact: true })).toBeVisible();
    await expect.element(page.getByText("constituency", { exact: true })).toBeVisible();
    await expect.element(page.getByText(mailingsCopy.mailingEditor.onlyForLabel("signed the letter"))).toBeVisible();
    await expect.element(page.getByText("Will you come to the example conference?")).toBeVisible();
    expect(page.getByRole("listitem").all()).toHaveLength(1);
  });

  it("shows links, a linked field, and quotes", async () => {
    const link = { type: "link" as const, attrs: { href: "https://pauseai.uk/join" } };
    await render(
      <MailingLetter
        doc={{
          type: "doc",
          content: [
            {
              type: "blockquote",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Join", marks: [link] },
                    { type: "field", attrs: { field: "name" }, marks: [link] },
                  ],
                },
              ],
            },
          ],
        }}
      />,
    );
    await expect.element(page.getByRole("link", { name: "Join" })).toHaveAttribute("href", "https://pauseai.uk/join");
    await expect.element(page.getByRole("link", { name: "name" })).toHaveAttribute("href", "https://pauseai.uk/join");
    expect(document.querySelector("blockquote p")!.textContent).toBe("Joinname");
  });

  it("names a part's condition by its ID with no labels", async () => {
    await render(<MailingLetter doc={exampleMailingLetter} />);
    await expect
      .element(page.getByText(mailingsCopy.mailingEditor.onlyForLabel("frontier-ai-letter:signed")))
      .toBeVisible();
  });
});
