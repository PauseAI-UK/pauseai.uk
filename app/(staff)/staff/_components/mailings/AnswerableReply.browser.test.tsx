import { expect, it, describe } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused } from "@/lib/form-result";
import { mailingsCopy } from "./copy";
import AnswerableReply from "./AnswerableReply";
import { AnswerableReplyExample, ReplyButtonExample } from "./AnswerableReply.gallery.client";

const copy = mailingsCopy.answers;

describe("AnswerableReply's example in the gallery", () => {
  it("logs an answer sent to a reply", async () => {
    await render(<AnswerableReplyExample opened />);
    await page.getByRole("textbox", { name: copy.answerLabel }).fill("Thanks");
    await page.getByRole("button", { name: copy.send }).click();
    const logged = page.getByRole("list", { name: "Event log" }).getByRole("listitem");
    await expect.element(logged).toBeVisible();
    expect(logged.element().textContent).toMatch(/^answer\(1, "[0-9a-f-]{36}", \{"type":"doc"/);
  });

  it("says the reply failed to send when sending it threw, and stays open with its words", async () => {
    // What a Server Action rejects with when the server threw: a digest, so the site isn't told of it again.
    const thrown = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1" });
    await render(
      <AnswerableReply
        replyId={1}
        from="PauseAI UK <hello@pauseai.uk>"
        to="jane@example.com"
        subject="Re: Thank you for marching"
        answer={() => Promise.reject(thrown)}
        opened
      >
        {() => <p>Could you take me off this list please?</p>}
      </AnswerableReply>,
    );
    await page.getByRole("textbox", { name: copy.answerLabel }).fill("Thanks");
    await page.getByRole("button", { name: copy.send }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.notSent.failed);
    await expect.element(page.getByRole("textbox", { name: copy.answerLabel })).toHaveTextContent("Thanks");
  });

  it("says why the reply was refused, and stays open with its words", async () => {
    await render(
      <AnswerableReply
        replyId={1}
        from="PauseAI UK <hello@pauseai.uk>"
        to="jane@example.com"
        subject="Re: Thank you for marching"
        answer={() => Promise.resolve(refused("gone"))}
        opened
      >
        {() => <p>Could you take me off this list please?</p>}
      </AnswerableReply>,
    );
    await page.getByRole("textbox", { name: copy.answerLabel }).fill("Thanks");
    await page.getByRole("button", { name: copy.send }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.notSent.gone);
    await expect.element(page.getByRole("textbox", { name: copy.answerLabel })).toHaveTextContent("Thanks");
  });

  it("logs Reply's press", async () => {
    await render(<ReplyButtonExample />);
    await page.getByRole("button", { name: copy.reply }).click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent("write()");
  });
});
