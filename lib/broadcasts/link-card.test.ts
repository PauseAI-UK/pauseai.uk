import { describe, expect, it } from "vitest";
import type { MailingBlock } from "@/lib/mailings/doc";
import { firstLink } from "./link-card";

const paragraph = (text: string): MailingBlock => ({ type: "paragraph", content: [{ type: "text", text }] });

describe("firstLink", () => {
  it("finds the first http:// or https:// address, leaving a sentence's end out of it", () => {
    expect(firstLink([paragraph("See https://pauseai.uk/march. Or http://example.org")])).toBe(
      "https://pauseai.uk/march",
    );
  });

  it("looks in lists and quotes, in order, past empty lines", () => {
    const words: MailingBlock[] = [
      { type: "paragraph" },
      { type: "blockquote", content: [paragraph("Pause AI now.")] },
      { type: "bulletList", content: [{ type: "listItem", content: [paragraph("http://example.org/list")] }] },
      paragraph("https://pauseai.uk/later"),
    ];
    expect(firstLink(words)).toBe("http://example.org/list");
  });

  it("ends an address at a field or a line break", () => {
    const words: MailingBlock[] = [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "https://pauseai.uk/a" },
          { type: "field", attrs: { field: "firstName" } },
          { type: "text", text: "x" },
          { type: "hardBreak" },
        ],
      },
    ];
    expect(firstLink(words)).toBe("https://pauseai.uk/a");
  });

  it("finds none in words without one, nor an address WhatsApp makes no card for, such as www.", () => {
    expect(firstLink([paragraph("Meet at 11:00 at www.example.org")])).toBeUndefined();
  });
});
