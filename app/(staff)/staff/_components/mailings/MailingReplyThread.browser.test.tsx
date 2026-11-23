import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffTime } from "@/lib/staff-time";
import MailingReplyThread from "./MailingReplyThread";
import type { AnswerAction } from "./AnswerableReply";
import {
  exampleDealtThread,
  exampleWaitingThread,
  MailingReplyThreadExample,
} from "./MailingReplyThread.gallery.client";
import { mailingsCopy } from "./copy";

const copy = mailingsCopy.answers;

describe("MailingReplyThread", () => {
  it("puts Reply and Nothing to do under the reply waiting, and sends an answer to it from the page", async () => {
    const answer = vi.fn<AnswerAction>(async () => ({ sent: true }));
    const deal = vi.fn();
    await render(
      <MailingReplyThread
        thread={exampleWaitingThread}
        waiting={{ id: 1, account: "jo@pauseai.uk" }}
        canAnswer
        deal={deal}
        answer={answer}
      />,
    );
    await page.getByRole("button", { name: copy.reply }).click();
    // Written as it will go, after her reply: from the letter's From name at the mailbox, to Polly, "Re:" as hers.
    const draft = page.getByRole("article", { name: "Re: Edinburgh follow-up" }).last();
    const editor = draft.getByRole("textbox", { name: copy.answerLabel });
    await expect.element(editor).toBeVisible();
    expect(draft.element().textContent).toContain("FromJo Seed <jo@pauseai.uk>");
    expect(draft.element().textContent).toContain("ToPolly Placeholder <polly.placeholder.mp@parliament.uk>");
    await editor.fill("Tuesday?");
    await draft.getByRole("button", { name: copy.send }).click();
    await vi.waitFor(() => expect(answer).toHaveBeenCalledOnce());
    expect(answer.mock.calls[0][0]).toBe(1);
  });

  it("says where to answer a reply that came to someone else's mailbox, with Nothing to do beside it", async () => {
    await render(<MailingReplyThreadExample canAnswer={false} />);
    await expect.element(page.getByText(copy.answerElsewhere("jo@pauseai.uk"))).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.reply })).not.toBeInTheDocument();
    await page.getByRole("button", { name: copy.nothing }).click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent('deal({"replyId":"1"})');
  });

  it("says who sent our answer from the page and who marked a reply as needing nothing, with no buttons once none waits", async () => {
    await render(<MailingReplyThreadExample dealt />);
    await expect.element(page.getByText(copy.sentBy("jo@pauseai.uk"))).toBeVisible();
    const [, , marked] = exampleDealtThread.messages;
    await expect.element(page.getByText(copy.nothingDone("sam@pauseai.uk", staffTime(marked.dealtAt!)))).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.nothing })).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: copy.reply })).not.toBeInTheDocument();
  });
});
