import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { waitStopsAt } from "@/lib/broadcasts";
import { londonDate, staffTime } from "@/lib/staff-time";
import { broadcastCounts, BroadcastWaiting, CopyStatus } from "./BroadcastView";
import {
  exampleBroadcastAnswers,
  exampleBroadcastEmail,
  exampleBroadcastReplies,
  exampleBroadcastSummary,
  exampleMessageCopy,
  exampleTextAnswers,
  exampleTextReplies,
  exampleTextReplyPastDay,
} from "./BroadcastWriter.examples";
import MessageCopyView from "./MessageCopyView";
import AnswerableReply, { type AnswerAction } from "./AnswerableReply";
import ReplyActions, { ReplyButton } from "./ReplyActions";

const copy = staffCopy.broadcastPages;
const topics = staffCopy.supporters.detail.permissions.topics;
const optOut = staffCopy.supporters.detail.permissions.recordOptOut.open;
const emailCopy = {
  ...exampleMessageCopy,
  channel: "email" as const,
  subject: "Thank you for marching",
  sentFrom: "hello@pauseai.uk",
  address: "jane@example.com",
  topics: ["newsletter" as const],
  replies: exampleBroadcastReplies,
  answers: exampleBroadcastAnswers,
};

describe("replies to broadcasts", () => {
  it("show under the email, each with what to record it as, what was made of it, our answer, or that it's automatic", async () => {
    const deal = vi.fn();
    await render(<MessageCopyView one={emailCopy} actions={{ deal, answer: vi.fn() }} />);
    await expect.element(page.getByText("Could you take me off this list please?")).toBeVisible();
    // Their name, as their copy had it.
    await expect.element(page.getByText("Jane Example <jane@example.com>").first()).toBeVisible();
    await expect
      .element(page.getByText(copy.replies.nothingDone("jo@pauseai.uk", staffTime(new Date("2026-11-07T10:00:00Z")))))
      .toBeVisible();
    // In the History, each with who did it on a line under it.
    const history = page.getByRole("list", { name: staffCopy.letters.detail.historyTitle });
    const entry = (label: string) => history.getByText(label, { exact: true }).element().closest("li")!.textContent;
    expect(entry(copy.replies.historyNothing)).toContain(`${staffCopy.letters.detail.fields.by}jo@pauseai.uk`);
    // Too little recorded to open as JSON, as a letter's can be.
    expect(history.getByRole("button", { name: staffCopy.changes.json }).query()).toBeNull();
    // Jo's answer, after the reply it answers, and in the History.
    await expect.element(page.getByText("Hi Jane, it's on 6 December. See you there!")).toBeVisible();
    await expect.element(page.getByText(copy.replies.sentBy("jo@pauseai.uk"))).toBeVisible();
    expect(entry(copy.replies.historyAnswered)).toContain(`${staffCopy.letters.detail.fields.by}jo@pauseai.uk`);
    // The answered reply can still be an opt-out, but has no need of Nothing to do; any but the automatic one, answered.
    await expect.element(page.getByRole("button", { name: optOut })).toHaveLength(2);
    await expect.element(page.getByRole("button", { name: copy.replies.nothing })).toHaveLength(1);
    await expect.element(page.getByRole("button", { name: copy.replies.reply })).toHaveLength(3);
    await page.getByRole("button", { name: copy.replies.nothing }).click();
    await vi.waitFor(() => expect(deal).toHaveBeenCalledOnce());
    expect(Object.fromEntries((deal.mock.calls[0][0] as FormData).entries())).toEqual({
      replyId: "1",
      decision: "nothing",
    });
  });

  it("say when there are no words to show, or an answer may not have gone, and offer no buttons without a way to record", async () => {
    await render(
      <MessageCopyView
        one={{
          ...emailCopy,
          replies: [
            // From another address than the copy went to, so without the name the copy had.
            { ...exampleBroadcastReplies[0], text: null, from: "j.smith@example.org" },
            { ...exampleBroadcastReplies[1], outcome: "opted-out", dealtBy: "sam@pauseai.uk" },
          ],
          answers: [{ ...exampleBroadcastAnswers[0], replyId: exampleBroadcastReplies[1].id, sentAt: null }],
        }}
      />,
    );
    await expect.element(page.getByText(copy.replies.noText)).toBeVisible();
    await expect.element(page.getByText("j.smith@example.org", { exact: true })).toBeVisible();
    await expect.element(page.getByRole("button", { name: optOut })).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: copy.replies.reply })).not.toBeInTheDocument();
    const history = page.getByRole("list", { name: staffCopy.letters.detail.historyTitle });
    expect(
      history.getByText(copy.replies.historyOptedOut, { exact: true }).element().closest("li")!.textContent,
    ).toContain(
      `${staffCopy.letters.detail.fields.by}sam@pauseai.uk${staffCopy.letters.detail.fields.how}${copy.replies.how}`,
    );
    await expect.element(page.getByText(copy.replies.stillSending("hello@pauseai.uk"))).toBeVisible();
  });

  it("record as an opt-out of what the email went under, or of all bulk email, in the form a supporter's page has", async () => {
    const deal = vi.fn();
    await render(<ReplyActions replyId={4} topics={["newsletter", "events"]} deal={deal} />);
    const words = staffCopy.supporters.detail.permissions.recordOptOut;
    const unsubscribe = async (choice: string) => {
      await page.getByRole("button", { name: optOut }).click();
      // How they told us is known, as it's the reply: no box for it.
      expect(page.getByRole("textbox", { name: words.how }).query()).toBeNull();
      await page.getByRole("button", { name: `${words.what}: ${words.choose}` }).click();
      await page.getByRole("button", { name: choice }).click();
      await page.getByRole("button", { name: words.record }).click();
    };
    await unsubscribe(copy.replies.topics(`${topics.newsletter}, ${topics.events}`));
    await vi.waitFor(() => expect(deal).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries((deal.mock.calls[0][0] as FormData).entries())).toEqual({
      replyId: "4",
      decision: "topics",
    });
    // Recorded, it closes, saying nothing of an opt-out there already, which a reply can't know of.
    await expect.element(page.getByText(words.already)).not.toBeInTheDocument();
    await unsubscribe(copy.replies.bulk);
    await vi.waitFor(() => expect(deal).toHaveBeenCalledTimes(2));
    expect((deal.mock.calls[1][0] as FormData).get("decision")).toBe("bulk");
  });

  it("write an answer after the reply in the thread, as it will be sent, and send it", async () => {
    const answer = vi.fn<AnswerAction>(async () => ({ sent: true }));
    await render(
      <AnswerableReply
        replyId={4}
        from="PauseAI UK <hello@pauseai.uk>"
        to="jane@example.com"
        subject="Thank you"
        answer={answer}
      >
        {(write) => (
          <>
            <p>Their reply</p>
            {write && <ReplyButton write={write} />}
          </>
        )}
      </AnswerableReply>,
    );
    await page.getByRole("button", { name: copy.replies.reply }).click();
    // A draft in the thread: from us, to them, "Re:" once, the broadcasts' editor without merge fields.
    const draft = page.getByRole("article", { name: "Re: Thank you" });
    const editor = draft.getByRole("textbox", { name: copy.replies.answerLabel });
    await expect.element(draft.getByText("PauseAI UK <hello@pauseai.uk>")).toBeVisible();
    await expect.element(editor).toHaveFocus();
    await expect.element(page.getByText(staffCopy.mailingEditor.fieldsHeading)).not.toBeInTheDocument();
    // Nothing to send till it has words.
    await expect.element(draft.getByRole("button", { name: copy.replies.send })).toBeDisabled();
    await expect.element(page.getByRole("button", { name: copy.replies.reply })).not.toBeInTheDocument();
    await editor.fill("Thanks, Jane.");
    // While it sends, it says so, and can't be sent again or discarded.
    let went = () => {};
    answer.mockImplementationOnce(() => new Promise((done) => (went = () => done({ sent: true }))));
    await draft.getByRole("button", { name: copy.replies.send }).click();
    await expect.element(draft.getByRole("button", { name: copy.replies.sending })).toBeDisabled();
    await expect.element(draft.getByRole("button", { name: copy.replies.discard })).toBeDisabled();
    // Its keys don't send it again meanwhile.
    await editor.click();
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    expect(answer).toHaveBeenCalledOnce();
    went();
    await vi.waitFor(() => expect(answer).toHaveBeenCalledOnce());
    expect(answer.mock.calls[0]).toEqual([
      4,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      expect.objectContaining({ type: "doc" }),
    ]);
    // Sent, it closes, Reply back, and the page shows it; opened again, it's a new draft, with no words.
    await expect.element(page.getByRole("article")).not.toBeInTheDocument();
    await page.getByRole("button", { name: copy.replies.reply }).click();
    await expect.element(draft.getByRole("button", { name: copy.replies.send })).toBeDisabled();
    // Discard closes it.
    await draft.getByRole("button", { name: copy.replies.discard }).click();
    await expect.element(page.getByRole("article")).not.toBeInTheDocument();
  });

  it("send an answer with Ctrl+Enter or Cmd+Enter, saying why one didn't go, and keep it to send again", async () => {
    const answer = vi.fn<AnswerAction>(async () => ({ sent: false, reason: "failed" }));
    await render(
      <AnswerableReply
        replyId={4}
        from="us@pauseai.uk"
        to="jane@example.com"
        subject="Re: Thanks"
        answer={answer}
        opened
        doNotEmail
      >
        {(write) => (
          <>
            <p>Their reply</p>
            {write && <ReplyButton write={write} />}
          </>
        )}
      </AnswerableReply>,
    );
    const draft = page.getByRole("article", { name: "Re: Thanks" });
    const editor = draft.getByRole("textbox", { name: copy.replies.answerLabel });
    // To someone with "Do not email", it warns that it goes all the same.
    await expect.element(page.getByText(copy.replies.doNotEmail)).toBeVisible();
    // Shown open, it leaves the cursor where it is.
    await expect.element(editor).not.toHaveFocus();
    // With no words, the keys send nothing; Enter alone is a new line.
    await editor.click();
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await editor.fill("Done.");
    await userEvent.keyboard("{Enter}");
    expect(answer).not.toHaveBeenCalled();
    await userEvent.keyboard("{Control>}{Enter}{/Control}");
    await vi.waitFor(() => expect(answer).toHaveBeenCalledOnce());
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.replies.notSent.failed);
    await expect.element(editor).toHaveTextContent("Done.");
    await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
    await vi.waitFor(() => expect(answer).toHaveBeenCalledTimes(2));
    // The same draft, so it can't go twice.
    expect(answer.mock.calls[1][1]).toBe(answer.mock.calls[0][1]);
  });

  it("to a text show as bubbles, with our answer, and no Reply to one more than a day old", async () => {
    const answer = vi.fn<AnswerAction>(async () => ({ sent: false, reason: "window" }));
    await render(
      <MessageCopyView
        one={{
          ...exampleMessageCopy,
          replies: [...exampleTextReplies, exampleTextReplyPastDay],
          answers: [...exampleTextAnswers, { ...exampleTextAnswers[0], id: 12, sentAt: null }],
        }}
        actions={{ deal: vi.fn(), answer }}
      />,
    );
    // Theirs as they came, ours as sent, with who sent it, and one whose sending never finished.
    await expect.element(page.getByText("Is it the same place as last time?")).toBeVisible();
    await expect.element(page.getByText("Yes, Parliament Square, by the statue.").first()).toBeVisible();
    await expect.element(page.getByText(copy.replies.sentBy("jo@pauseai.uk"))).toBeVisible();
    await expect.element(page.getByText(copy.replies.stillSending("+447700900000"))).toBeVisible();
    // Their name, as their copy had it.
    await expect.element(page.getByText("Jane Example <+447700900001>").first()).toBeVisible();
    // The one too old for WhatsApp says so, and has no Reply; the others do, the answered one and the one waiting.
    await expect.element(page.getByText(copy.replies.windowClosed)).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.replies.reply })).toHaveLength(2);
    // An opt-out of a reply to a text is of every text.
    await page.getByRole("button", { name: optOut }).last().click();
    const words = staffCopy.supporters.detail.permissions.recordOptOut;
    await page.getByRole("button", { name: `${words.what}: ${words.choose}` }).click();
    await expect.element(page.getByRole("button", { name: copy.replies.allTexts })).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.replies.topicsText(topics.events) })).toBeVisible();
    // The answer is written as a bubble of ours, not an email: no subject.
    await page.getByRole("button", { name: copy.replies.reply }).last().click();
    await expect.element(page.getByRole("article")).not.toBeInTheDocument();
    await page.getByRole("textbox", { name: copy.replies.answerLabel }).fill("Thanks!");
    await page.getByRole("button", { name: copy.replies.send }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.replies.notSent.window);
  });

  it("are counted on an email's or a text's page, each count the colour of its tags, the same boxes either way, and tagged on each recipient", async () => {
    const states = { ...exampleBroadcastSummary.states, replied: 3, look: 1 };
    const counts = broadcastCounts({ ...exampleBroadcastSummary, channel: "email", states });
    expect(counts.find((count) => count.key === "replied")).toEqual({
      key: "replied",
      n: 3,
      label: copy.counts.replied,
      tone: "green",
    });
    expect(counts.find((count) => count.key === "look")).toEqual({
      key: "look",
      n: 1,
      label: copy.counts.look,
      tone: "blue",
    });
    // Read counts what it has, as every count does: none for an email, which is never said to be read.
    expect(counts.find((count) => count.key === "read")!.n).toBe(0);
    const text = broadcastCounts({ ...exampleBroadcastSummary, channel: "text", states: { ...states, read: 4 } });
    expect(text.find((count) => count.key === "read")!.n).toBe(4);
    expect(counts.map((count) => count.key)).toEqual(text.map((count) => count.key));
    await render(
      <>
        <CopyStatus copyOf={{ state: "replied", why: null }} />
        <CopyStatus copyOf={{ state: "look", why: null }} />
      </>,
    );
    await expect.element(page.getByText(copy.copyStates.replied!, { exact: true })).toBeVisible();
    await expect.element(page.getByText(copy.copyStates.look!)).toBeVisible();
  });
});

describe("BroadcastWaiting", () => {
  it("says that one is waiting and why, or that it stopped; nothing for one scheduled", async () => {
    const due = new Date("2026-11-07T07:18:00Z");
    // Days into sending when it began to wait: it gives up that long after, not after its time.
    const began = new Date("2026-11-11T07:18:00Z");
    const { rerender } = await render(
      <BroadcastWaiting
        written={{ ...exampleBroadcastEmail, state: "sending", dueAt: due, waitingSince: began, waitReason: "pull" }}
      />,
    );
    await expect.element(page.getByText(copy.waiting("pull", londonDate(waitStopsAt(began))))).toBeVisible();
    await rerender(
      <BroadcastWaiting
        written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason: "civicrm" }}
      />,
    );
    await expect.element(page.getByText(copy.gaveUp)).toBeVisible();
    await rerender(
      <BroadcastWaiting
        written={{
          ...exampleBroadcastEmail,
          channel: "text",
          state: "cancelled",
          gaveUp: true,
          waitReason: "template",
        }}
      />,
    );
    await expect.element(page.getByText(copy.gaveUpTemplate)).toBeVisible();
    // Its seven days ran out while CiviCRM was down; its copies kept failing.
    for (const [waitReason, words] of [
      ["late", copy.gaveUpLate],
      ["failing", copy.gaveUpFailing],
    ] as const) {
      await rerender(
        <BroadcastWaiting written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason }} />,
      );
      await expect.element(page.getByText(words)).toBeVisible();
    }
    // Resting after its copies failed, till when.
    const until = new Date("2026-11-11T07:43:00Z");
    await rerender(<BroadcastWaiting written={{ ...exampleBroadcastEmail, state: "sending", restingUntil: until }} />);
    await expect.element(page.getByText(copy.resting(staffTime(until)))).toBeVisible();
    const { container } = await render(
      <BroadcastWaiting written={{ ...exampleBroadcastEmail, channel: "text", state: "scheduled", dueAt: due }} />,
    );
    expect(container.textContent).toBe("");
  });
});
