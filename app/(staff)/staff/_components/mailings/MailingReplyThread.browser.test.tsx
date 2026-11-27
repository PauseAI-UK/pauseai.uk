import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { refused } from "@/lib/form-result";
import { staffTime } from "@/lib/staff-time";
import { RefusalPlace } from "../ui/ResultForm";
import MailingReplyThread from "./MailingReplyThread";
import type { AnswerAction } from "./AnswerableReply";
import {
  exampleDealtThread,
  exampleWaitingThread,
  MailingReplyThreadExample,
} from "./MailingReplyThread.gallery.client";
import { mailingsCopy } from "./copy";
import { exampleAsks } from "../asks/AsksList.examples";
import { examplePolitician } from "../politicians/PoliticianTable.examples";
import type { SetStatus } from "../politicians/AskRow";
import { politiciansCopy } from "../politicians/copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { buttonClass } from "@/components/ui/Button";

const copy = mailingsCopy.answers;

// The page's address, which the place a page says things at its top reads; and a router, for the thread's links.
vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/mailings/1/letters/2",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({}),
}));

describe("MailingReplyThread", () => {
  it("puts Set answer among the reply's buttons for an ask staff record, opening its form, plainer beside Reply", async () => {
    const words = politiciansCopy.politician;
    const [byHand, , imported] = exampleAsks;
    const setStatus = vi.fn<SetStatus>(async () => ({ ok: true }));
    const props = {
      thread: exampleWaitingThread,
      waiting: { id: 1, account: "jo@pauseai.uk" },
      deal: () => Promise.resolve({ ok: true as const }),
      answer: () => Promise.resolve({ ok: true as const }),
    };
    const politician = { ...examplePolitician, airtableId: null };
    const { rerender } = await render(
      <MailingReplyThread {...props} canAnswer={false} asked={{ politician, ask: byHand, setStatus }} />,
    );
    const set = page.getByRole("button", { name: words.setAnswer });
    expect(set.element().className).toBe(buttonClass({ variant: "primary", size: "small", fit: true }));
    await set.click();
    await page.getByRole("radio", { name: staffVocabulary.statuses.declined }).click();
    await page.getByLabelText(words.note).fill("Their office said no");
    // Pressed where it is, as the bubble hangs below the test's short frame.
    (page.getByRole("button", { name: words.save }).element() as HTMLButtonElement).click();
    await expect.poll(() => setStatus.mock.calls.length).toBe(1);
    expect(Object.fromEntries(setStatus.mock.calls[0]![0])).toEqual({
      politicianId: String(politician.id),
      ask: byHand!.slug,
      status: "declined",
      note: "Their office said no",
    });
    // Beside Reply, plainer.
    await rerender(<MailingReplyThread {...props} canAnswer asked={{ politician, ask: byHand, setStatus }} />);
    expect(set.element().className).toBe(buttonClass({ variant: "ghost", size: "small", fit: true }));
    // None for an ask an import answers, a mailing with no ask, or none given.
    await rerender(<MailingReplyThread {...props} canAnswer asked={{ politician, ask: imported, setStatus }} />);
    expect(set.all()).toHaveLength(0);
    await rerender(<MailingReplyThread {...props} canAnswer asked={{ politician, ask: undefined, setStatus }} />);
    expect(set.all()).toHaveLength(0);
    await rerender(<MailingReplyThread {...props} canAnswer />);
    expect(set.all()).toHaveLength(0);
  });

  it("says at the top of the page that someone has already dealt with the reply", async () => {
    await render(
      <RefusalPlace>
        <MailingReplyThread
          thread={exampleWaitingThread}
          waiting={{ id: 1, account: "jo@pauseai.uk" }}
          canAnswer
          deal={() => Promise.resolve(refused("gone"))}
          answer={() => Promise.resolve({ ok: true })}
        />
      </RefusalPlace>,
    );
    const nothing = page.getByRole("button", { name: copy.nothing });
    await nothing.click();
    const alert = page.getByRole("alert");
    await expect.element(alert).toHaveTextContent(mailingsCopy.refusals.nothingToDo.gone);
    // Over the page, not in the form.
    expect(nothing.element().closest("form")!.contains(alert.element())).toBe(false);
  });

  it("puts Reply and Nothing to do under the reply waiting, and sends an answer to it from the page", async () => {
    const answer = vi.fn<AnswerAction>(async () => ({ ok: true }));
    const deal = vi.fn<(form: FormData) => Promise<{ ok: true }>>();
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

  it("says only the owner can reply to a reply that came to their mailbox, with Nothing to do beside it", async () => {
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
