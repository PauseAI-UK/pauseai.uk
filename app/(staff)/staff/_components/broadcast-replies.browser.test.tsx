import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { stopsAt } from "@/lib/broadcasts";
import { staffTime } from "@/lib/staff-time";
import { broadcastCounts, BroadcastWaiting, CopyStatus } from "./BroadcastView";
import {
  exampleBroadcastAnswers,
  exampleBroadcastEmail,
  exampleBroadcastReplies,
  exampleBroadcastSummary,
  exampleMessageCopy,
} from "./BroadcastWriter.examples";
import MessageCopyView from "./MessageCopyView";
import AnswerableReply, { type AnswerAction } from "./AnswerableReply";
import ReplyActions from "./ReplyActions";

const copy = staffCopy.broadcastPages;
const topics = staffCopy.supporters.detail.permissions.topics;
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
    await expect
      .element(page.getByText(copy.replies.nothingDone("jo@pauseai.uk", staffTime(new Date("2026-11-07T10:00:00Z")))))
      .toBeVisible();
    await expect.element(page.getByText(copy.replies.automatic)).toBeVisible();
    await expect.element(page.getByText(copy.replies.historyNothing("jo@pauseai.uk"))).toBeVisible();
    // Jo's answer, after the reply it answers, and in the History.
    await expect.element(page.getByText("Hi Jane, it's on 6 December. See you there!")).toBeVisible();
    await expect.element(page.getByText(copy.replies.sentBy("jo@pauseai.uk"))).toBeVisible();
    await expect.element(page.getByText(copy.replies.historyAnswered("jo@pauseai.uk"))).toBeVisible();
    // The answered reply can still be an opt-out, but has no need of Nothing to do; any but the automatic one, answered.
    await expect.element(page.getByRole("button", { name: copy.replies.optOut })).toHaveLength(2);
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
            { ...exampleBroadcastReplies[0], text: null },
            { ...exampleBroadcastReplies[1], outcome: "opted-out", dealtBy: "sam@pauseai.uk" },
          ],
          answers: [{ ...exampleBroadcastAnswers[0], replyId: exampleBroadcastReplies[1].id, sentAt: null }],
        }}
      />,
    );
    await expect.element(page.getByText(copy.replies.noText)).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.replies.optOut })).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: copy.replies.reply })).not.toBeInTheDocument();
    await expect.element(page.getByText(copy.replies.historyOptedOut("sam@pauseai.uk"))).toBeVisible();
    await expect.element(page.getByText(copy.replies.stillSending("hello@pauseai.uk"))).toBeVisible();
  });

  it("record as an opt-out of what the email went under, or of all bulk email", async () => {
    const deal = vi.fn();
    await render(<ReplyActions replyId={4} topics={["newsletter", "events"]} deal={deal} />);
    // In the Opt out menu.
    await page.getByRole("button", { name: copy.replies.optOut }).click();
    await page.getByRole("button", { name: copy.replies.topics(`${topics.newsletter}, ${topics.events}`) }).click();
    await vi.waitFor(() => expect(deal).toHaveBeenCalledTimes(1));
    expect(Object.fromEntries((deal.mock.calls[0][0] as FormData).entries())).toEqual({
      replyId: "4",
      decision: "topics",
    });
    // The menu stays up while the form sends, till the page comes back; here it doesn't.
    await page.getByRole("button", { name: copy.replies.bulk }).click();
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
        <p>Their reply</p>
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
    went();
    await vi.waitFor(() => expect(answer).toHaveBeenCalledOnce());
    expect(answer.mock.calls[0]).toEqual([
      4,
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      expect.objectContaining({ type: "doc" }),
    ]);
    // Sent, it folds, and the page shows it; opened again, it's a new draft, with no words.
    await expect.element(page.getByRole("article")).not.toBeInTheDocument();
    await page.getByRole("button", { name: copy.replies.reply }).click();
    await expect.element(draft.getByRole("button", { name: copy.replies.send })).toBeDisabled();
    // Discard folds it.
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
      >
        <p>Their reply</p>
      </AnswerableReply>,
    );
    const draft = page.getByRole("article", { name: "Re: Thanks" });
    const editor = draft.getByRole("textbox", { name: copy.replies.answerLabel });
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

  it("are counted on an email's page, those to look at amber, and tagged on each recipient", async () => {
    const counts = broadcastCounts({ ...exampleBroadcastSummary, channel: "email", replied: 3, toLookAt: 1 });
    expect(counts.slice(-2)).toEqual([
      { key: "replied", n: 3, label: copy.counts.replied },
      { key: "look", n: 1, label: copy.counts.look, tone: "amber" },
    ]);
    expect(broadcastCounts({ ...exampleBroadcastSummary, channel: "email", replied: 0, toLookAt: 0 }).at(-1)?.key).toBe(
      "replied",
    );
    const went = { status: "delivered", skipReason: null, read: false, bounced: false, optedOut: false };
    await render(
      <>
        <CopyStatus copyOf={{ ...went, replied: true }} />
        <CopyStatus copyOf={{ ...went, replied: true, toLookAt: true }} />
      </>,
    );
    await expect.element(page.getByText(copy.repliedTag)).toBeVisible();
    await expect.element(page.getByText(copy.lookTag)).toBeVisible();
  });
});

describe("BroadcastWaiting", () => {
  it("says when a scheduled email would stop, that one is waiting and why, or that it stopped; nothing for a text", async () => {
    const due = new Date("2026-11-07T07:18:00Z");
    const stops = staffTime(stopsAt(due));
    const { rerender } = await render(
      <BroadcastWaiting written={{ ...exampleBroadcastEmail, state: "scheduled", dueAt: due }} />,
    );
    await expect.element(page.getByText(copy.stopsBy(stops))).toBeVisible();
    await rerender(
      <BroadcastWaiting
        written={{ ...exampleBroadcastEmail, state: "sending", dueAt: due, waitingSince: due, waitReason: "pull" }}
      />,
    );
    await expect.element(page.getByText(copy.waiting(staffTime(due), "pull", stops))).toBeVisible();
    await rerender(
      <BroadcastWaiting
        written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason: "civicrm" }}
      />,
    );
    await expect.element(page.getByText(copy.gaveUp)).toBeVisible();
    const { container } = await render(
      <BroadcastWaiting written={{ ...exampleBroadcastEmail, channel: "text", state: "scheduled", dueAt: due }} />,
    );
    expect(container.textContent).toBe("");
  });
});
