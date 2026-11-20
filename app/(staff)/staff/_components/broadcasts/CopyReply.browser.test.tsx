import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { SITE_ACTOR } from "@/lib/broadcasts/broadcasts";
import { staffTime } from "@/lib/staff-time";
import { broadcastCounts } from "./BroadcastView";
import { CopyStatus } from "../letters/CopyStatus";
import {
  exampleBroadcastAnswers,
  exampleBroadcastReplies,
  exampleBroadcastSummary,
  exampleMessageCopy,
  exampleTextAnswers,
  exampleTextKinds,
  exampleTextReplies,
  exampleTextReplyPastDay,
} from "./BroadcastWriter.examples";
import type { BroadcastAnswer } from "@/lib/broadcasts/answers.server";
import type { BroadcastReply } from "@/lib/broadcasts/replies.server";
import MessageCopyView from "./MessageCopyView";
import AnswerableReply, { type AnswerAction } from "./AnswerableReply";
import ReplyActions, { ReplyButton } from "./ReplyActions";
import { supportersCopy } from "../supporters/copy";
import { mailingsCopy } from "../mailings/copy";
import { lettersCopy } from "../letters/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { staffVocabulary } from "@/lib/staff-vocabulary";

const copy = broadcastsCopy.broadcastPages;
const stateWords = lettersCopy.copyStates;
const lists = supportersCopy.supporters.filters.lists;
const optOut = supportersCopy.supporters.detail.permissions.recordOptOut.open;
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
    await render(<MessageCopyView one={emailCopy} actions={{ deal, answer: vi.fn(), react: vi.fn() }} />);
    await expect.element(page.getByText("Could you take me off this list please?")).toBeVisible();
    // Their name, as their copy had it.
    await expect.element(page.getByText("Jane Example <jane@example.com>").first()).toBeVisible();
    await expect
      .element(page.getByText(copy.replies.nothingDone("jo@pauseai.uk", staffTime(new Date("2026-11-07T10:00:00Z")))))
      .toBeVisible();
    // In the History, each with who did it on a line under it.
    const history = page.getByRole("list", { name: lettersCopy.letters.detail.historyTitle });
    const entry = (label: string) => history.getByText(label, { exact: true }).element().closest("li")!.textContent;
    expect(entry(copy.replies.historyNothing)).toContain(`${lettersCopy.letters.detail.fields.by}jo@pauseai.uk`);
    // What each recorded opens as JSON, as a letter's can.
    expect(history.getByRole("button", { name: staffVocabulary.logged.json }).elements().length).toBeGreaterThan(0);
    // Jo's answer, after the reply it answers, and in the History.
    await expect.element(page.getByText("Hi Jane, it's on 6 December. See you there!")).toBeVisible();
    await expect.element(page.getByText(copy.replies.sentBy("jo@pauseai.uk"))).toBeVisible();
    expect(entry(copy.replies.historyAnswered)).toContain(`${lettersCopy.letters.detail.fields.by}jo@pauseai.uk`);
    // One set of buttons, for their latest, which deals with those before it too.
    await expect.element(page.getByRole("button", { name: optOut })).toHaveLength(1);
    await expect.element(page.getByRole("button", { name: copy.replies.nothing })).toHaveLength(1);
    await expect.element(page.getByRole("button", { name: copy.replies.reply })).toHaveLength(1);
    await expect.element(page.getByRole("button", { name: copy.replies.followUp })).not.toBeInTheDocument();
    await page.getByRole("button", { name: copy.replies.nothing }).click();
    await vi.waitFor(() => expect(deal).toHaveBeenCalledOnce());
    expect(Object.fromEntries((deal.mock.calls[0][0] as FormData).entries())).toEqual({
      replyId: "1",
      decision: "nothing",
    });
  });

  it("offer Follow up under their latest, once we've answered it, and nothing to write under any before it", async () => {
    // Their latest, recorded as needing nothing, can still be answered.
    const { rerender } = await render(
      <MessageCopyView
        one={{ ...emailCopy, replies: exampleBroadcastReplies.slice(0, 2), answers: [] }}
        actions={{ deal: vi.fn(), answer: vi.fn(), react: vi.fn() }}
      />,
    );
    await expect.element(page.getByRole("button", { name: copy.replies.reply })).toBeVisible();
    await rerender(
      <MessageCopyView
        one={{ ...emailCopy, replies: exampleBroadcastReplies.slice(0, 3) }}
        actions={{ deal: vi.fn(), answer: vi.fn(), react: vi.fn() }}
      />,
    );
    await expect.element(page.getByRole("button", { name: copy.replies.followUp })).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.replies.reply })).not.toBeInTheDocument();
    // Under our answer, the last message, and opened after it, at the foot of the thread.
    const thread = page.getByLabelText(copy.threadTitle).element();
    const ours = page.getByText("Hi Jane, it's on 6 December. See you there!").element();
    const button = page.getByRole("button", { name: copy.replies.followUp }).element();
    expect(ours.closest("article")!.contains(button)).toBe(true);
    // With Unsubscribe them beside it, but not Nothing to do, as it's answered.
    expect(ours.closest("article")!.textContent).toContain(optOut);
    await expect.element(page.getByRole("button", { name: copy.replies.nothing })).not.toBeInTheDocument();
    await page.getByRole("button", { name: copy.replies.followUp }).click();
    const draft = page.getByRole("textbox", { name: copy.replies.answerLabel }).element();
    expect(ours.compareDocumentPosition(draft) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(thread.contains(draft)).toBe(true);
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
    const history = page.getByRole("list", { name: lettersCopy.letters.detail.historyTitle });
    expect(
      history.getByText(copy.replies.historyOptedOut, { exact: true }).element().closest("li")!.textContent,
    ).toContain(
      `${lettersCopy.letters.detail.fields.by}sam@pauseai.uk${lettersCopy.letters.detail.fields.how}${copy.replies.how}`,
    );
    await expect.element(page.getByText(copy.replies.stillSending("hello@pauseai.uk"))).toBeVisible();
  });

  it("dealt with at once are one line in the history", async () => {
    const dealtAt = new Date("2026-11-07T10:00:00Z");
    const settled = { outcome: "nothing" as const, dealtBy: "jo@pauseai.uk", dealtAt };
    await render(
      <MessageCopyView
        one={{
          ...emailCopy,
          replies: [
            { ...exampleBroadcastReplies[1], ...settled },
            { ...exampleBroadcastReplies[3], ...settled },
          ],
          answers: [],
        }}
      />,
    );
    const history = page.getByRole("list", { name: lettersCopy.letters.detail.historyTitle });
    expect(history.getByText(copy.replies.historyNothing, { exact: true }).elements()).toHaveLength(1);
  });

  it("show a STOP the site recorded in the thread, but not twice in the history, as WhatsApp's opt-out is there", async () => {
    await render(
      <MessageCopyView
        one={{
          ...emailCopy,
          replies: [{ ...exampleBroadcastReplies[1], text: "STOP", outcome: "opted-out", dealtBy: SITE_ACTOR }],
          answers: [{ ...exampleBroadcastAnswers[0], replyId: exampleBroadcastReplies[1].id, sentBy: SITE_ACTOR }],
        }}
      />,
    );
    await expect.element(page.getByText("STOP", { exact: true })).toBeVisible();
    // Said to be the site's own, not a person's.
    await expect.element(page.getByText(copy.replies.sentAutomatically, { exact: true })).toBeVisible();
    await expect.element(page.getByText(copy.replies.optedOutAutomatically(""), { exact: false })).toBeVisible();
    const history = page.getByRole("list", { name: lettersCopy.letters.detail.historyTitle });
    await expect.element(history.getByText(copy.replies.historyOptedOut, { exact: true })).not.toBeInTheDocument();
    await expect.element(history.getByText(copy.replies.automatically, { exact: true })).toBeVisible();
  });

  it("record as an opt-out of what the email went under, or of all bulk email, in the form a supporter's page has", async () => {
    const deal = vi.fn();
    await render(<ReplyActions replyId={4} topics={["newsletter", "events"]} deal={deal} />);
    const words = supportersCopy.supporters.detail.permissions.recordOptOut;
    const unsubscribe = async (choice: string) => {
      await page.getByRole("button", { name: optOut }).click();
      // How they told us is known, as it's the reply: no box for it.
      expect(page.getByRole("textbox", { name: words.how }).query()).toBeNull();
      await page.getByRole("button", { name: `${words.what}: ${words.choose}` }).click();
      await page.getByRole("button", { name: choice }).click();
      await page.getByRole("button", { name: words.record }).click();
    };
    await unsubscribe(copy.replies.topics(lists.updates));
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
    await expect.element(page.getByText(mailingsCopy.mailingEditor.fieldsHeading)).not.toBeInTheDocument();
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
    const { rerender } = await render(
      <MessageCopyView
        one={{
          ...exampleMessageCopy,
          replies: [...exampleTextReplies, exampleTextReplyPastDay],
          answers: [...exampleTextAnswers, { ...exampleTextAnswers[0], id: 12, sentAt: null }],
        }}
        actions={{ deal: vi.fn(), answer, react: vi.fn() }}
      />,
    );
    // Theirs as they came, ours as sent, with who sent it, and one whose sending never finished.
    await expect.element(page.getByText("Is it the same place as last time?")).toBeVisible();
    await expect.element(page.getByText("Yes, Parliament Square, by the statue.").first()).toBeVisible();
    await expect
      .element(page.getByText(`${copy.replies.sentBy("jo@pauseai.uk")} · ${staffTime(exampleTextAnswers[0].sentAt!)}`))
      .toBeVisible();
    await expect.element(page.getByText(copy.replies.stillSending("+447700900000"))).toBeVisible();
    // Ours ticked as far as WhatsApp said it got, read; the one that may not have gone, none.
    const ours = page.getByText("Yes, Parliament Square, by the statue.");
    expect(ours.elements()).toHaveLength(2);
    expect(
      ours.elements()[0].parentElement!.parentElement!.querySelector(`[aria-label="${copy.events.read}"]`),
    ).not.toBeNull();
    expect(ours.elements()[1].parentElement!.parentElement!.querySelector("svg")).toBeNull();
    // Their name, as their copy had it.
    await expect.element(page.getByText("Jane Example", { exact: true }).first()).toBeVisible();
    // Their latest, too old for WhatsApp, says so, and has no Reply, nor has any before it.
    await expect.element(page.getByText(copy.replies.windowClosed)).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.replies.reply })).not.toBeInTheDocument();
    // With the one waiting their latest, it alone has Reply.
    await rerender(
      <MessageCopyView
        one={{ ...exampleMessageCopy, replies: exampleTextReplies, answers: exampleTextAnswers }}
        actions={{ deal: vi.fn(), answer, react: vi.fn() }}
      />,
    );
    await expect.element(page.getByRole("button", { name: copy.replies.reply })).toHaveLength(1);
    // The answer is written as a bubble of ours, not an email: no subject.
    await page.getByRole("button", { name: copy.replies.reply }).click();
    await expect.element(page.getByRole("article")).not.toBeInTheDocument();
    await page.getByRole("textbox", { name: copy.replies.answerLabel }).fill("Thanks!");
    await page.getByRole("button", { name: copy.replies.send }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.replies.notSent.window);
    // An opt-out of a reply to a text is of every text.
    await page.getByRole("button", { name: optOut }).last().click();
    const words = supportersCopy.supporters.detail.permissions.recordOptOut;
    await page.getByRole("button", { name: `${words.what}: ${words.choose}` }).click();
    await expect.element(page.getByRole("button", { name: copy.replies.allTexts })).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.replies.topicsText(lists.updates) })).toBeVisible();
    // Answered, Follow up is under our bubble, the last, and Reply is gone.
    await page.getByRole("button", { name: copy.replies.discard }).click();
    await rerender(
      <MessageCopyView
        one={{
          ...exampleMessageCopy,
          replies: exampleTextReplies,
          answers: [
            ...exampleTextAnswers,
            {
              ...exampleTextAnswers[0],
              id: 13,
              replyId: exampleTextReplies[1].id,
              body: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "Glad to help." }] }],
              },
            },
          ],
        }}
        actions={{ deal: vi.fn(), answer, react: vi.fn() }}
      />,
    );
    await expect.element(page.getByRole("button", { name: copy.replies.reply })).not.toBeInTheDocument();
    const last = page.getByText("Glad to help.").element();
    const followUp = page.getByRole("button", { name: copy.replies.followUp }).element();
    expect(last.compareDocumentPosition(followUp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("to a text that are more than words say what they were: a reaction its emoji under the message it's to, any other its kind over its words", async () => {
    await render(
      <MessageCopyView
        one={{
          ...exampleMessageCopy,
          replies: [exampleTextReplies[0], ...exampleTextKinds],
          answers: exampleTextAnswers,
        }}
        actions={{ deal: vi.fn(), answer: vi.fn<AnswerAction>(), react: vi.fn() }}
      />,
    );
    // The words in a bubble, not an emoji button under one.
    const bubble = (words: string) =>
      page
        .getByText(words, { exact: true })
        .elements()
        .find((element) => element.tagName !== "BUTTON")!.parentElement!;
    const [thumb, , lost] = exampleTextKinds;
    // A thumbs up to the broadcast, quoting its start, then taken back.
    expect(bubble("👍").textContent).toContain("Hi Jane, the march meets at 11:00 at Parliament Square.");
    // When it came, then, on the line under, when it went.
    expect(bubble("👍").textContent).toContain(
      `${copy.replies.reacted} · ${staffTime(thumb.receivedAt)}${copy.replies.reactionRemoved(staffTime(thumb.removedAt!))}`,
    );
    // A heart to our answer, quoting that, and still there.
    expect(bubble("❤️").textContent).toContain("Yes, Parliament Square, by the statue.");
    expect(bubble("❤️").textContent).not.toContain(copy.replies.reactionRemoved("").trim());
    // One from before emojis were kept says so, with nothing in place of its emoji.
    await expect
      .element(page.getByText(`${copy.replies.reactedNotKept} · ${staffTime(lost.receivedAt)}`))
      .toBeVisible();
    // A photo, over its caption; a place, its link to a map a link; a voice note and a kind with no name, alone.
    expect(bubble("Our banner from last time").textContent).toContain(copy.replies.kinds.image);
    await expect.element(page.getByText(copy.replies.kinds.location)).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: /google\.com\/maps/ }))
      .toHaveAttribute("href", expect.stringContaining("query=51.5007,-0.1268"));
    await expect.element(page.getByText(copy.replies.kinds.voice)).toBeVisible();
    await expect.element(page.getByText(copy.replies.kindOther("poll"))).toBeVisible();
    // None of them says there's no text to show.
    expect(document.body.textContent).not.toContain(copy.replies.noText);
  });

  it("quote a text whose merge values weren't kept with its fields as words, and never an answer still being sent", async () => {
    const [thumb, , lost] = exampleTextKinds;
    await render(
      <MessageCopyView
        one={{
          ...exampleMessageCopy,
          merge: null,
          // A reaction from before what it's to was kept, beside an answer WhatsApp has no ID for yet.
          replies: [thumb, lost],
          answers: [{ ...exampleTextAnswers[0], providerId: null, replyId: thumb.id }],
        }}
      />,
    );
    const quotes = page.getByText(/the march meets at 11:00 at Parliament Square\./).elements();
    // The text itself, and the quote over each reaction.
    expect(quotes).toHaveLength(3);
    expect(quotes[1].textContent).not.toContain("Jane");
  });

  it("to a text say WhatsApp won't take an answer only under their latest message, while it's unanswered", async () => {
    const view = (replies: BroadcastReply[], answers: BroadcastAnswer[] = []) => (
      <MessageCopyView
        one={{ ...exampleMessageCopy, replies, answers }}
        actions={{ deal: vi.fn(), answer: vi.fn(), react: vi.fn() }}
      />
    );
    // An old message before a newer one.
    const { rerender } = await render(view([exampleTextReplyPastDay, ...exampleTextReplies]));
    await expect.element(page.getByText("Is it the same place as last time?")).toBeVisible();
    expect(page.getByText(copy.replies.windowClosed).elements()).toEqual([]);
    // Their latest, answered.
    await rerender(
      view([exampleTextReplyPastDay], [{ ...exampleTextAnswers[0], replyId: exampleTextReplyPastDay.id }]),
    );
    await expect
      .element(page.getByText(`${copy.replies.sentBy("jo@pauseai.uk")} · ${staffTime(exampleTextAnswers[0].sentAt!)}`))
      .toBeVisible();
    expect(page.getByText(copy.replies.windowClosed).elements()).toEqual([]);
    // From a number the copy didn't go to: named by it, as a staff page writes it.
    await rerender(view([{ ...exampleTextReplyPastDay, from: "+447700900999" }]));
    await expect.element(page.getByText(copy.replies.windowClosed)).toBeVisible();
    await expect
      .element(page.getByLabelText(copy.threadTitle).getByText("07700 900999", { exact: true }))
      .toBeVisible();
  });

  it("are counted on an email's or a text's page, each count the colour of its tags, the same boxes either way, and tagged on each recipient", async () => {
    const states = { ...exampleBroadcastSummary.states, replied: 3, look: 1 };
    const counts = broadcastCounts({ ...exampleBroadcastSummary, channel: "email", states });
    expect(counts.find((count) => count.key === "replied")).toEqual({
      key: "replied",
      n: 3,
      label: stateWords.counts.replied,
      tone: "green",
    });
    expect(counts.find((count) => count.key === "look")).toEqual({
      key: "look",
      n: 1,
      label: stateWords.counts.look,
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
    await expect.element(page.getByText(stateWords.tags.replied!, { exact: true })).toBeVisible();
    await expect.element(page.getByText(stateWords.tags.look!)).toBeVisible();
  });
});
