import { expect, it, describe } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { AnswerableReplyExample } from "./AnswerableReply.gallery.client";

const copy = broadcastsCopy.broadcastPages;

describe("AnswerableReply's example in the gallery", () => {
  it("logs an answer sent to a reply", async () => {
    await render(<AnswerableReplyExample opened />);
    await page.getByRole("textbox", { name: copy.replies.answerLabel }).fill("Thanks");
    await page.getByRole("button", { name: copy.replies.send }).click();
    const logged = page.getByRole("list", { name: "Event log" }).getByRole("listitem");
    await expect.element(logged).toBeVisible();
    expect(logged.element().textContent).toMatch(/^answer\(1, "[0-9a-f-]{36}", \{"type":"doc"/);
  });
});
