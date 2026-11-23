import { expect, it, describe } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { ReplyActionsExample } from "./ReplyActions.gallery.client";

const copy = broadcastsCopy.broadcastPages;

describe("ReplyActions' examples in the gallery", () => {
  it("logs what a reply is recorded as", async () => {
    await render(<ReplyActionsExample />);
    await page.getByRole("button", { name: copy.replies.nothing }).click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent('deal({"replyId":"1","decision":"nothing"})');
  });

  it("logs Reply's press, before Unsubscribe them", async () => {
    await render(<ReplyActionsExample write />);
    await page.getByRole("button", { name: copy.replies.reply }).click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent("write()");
  });
});
