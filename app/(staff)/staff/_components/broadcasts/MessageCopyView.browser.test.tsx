import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffTime } from "@/lib/staff-time";
import MessageCopyView from "./MessageCopyView";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import {
  exampleMessageCopy,
  examplePictureId,
  examplePlace,
  exampleTextAnswers,
  exampleTextReplies,
  exampleUndeliveredReaction,
  exampleVariant,
} from "./BroadcastWriter.examples";
import { SITE_ACTOR } from "@/lib/broadcasts/broadcasts";
import { supportersCopy } from "../supporters/copy";
import { mailingsCopy } from "../mailings/copy";
import { lettersCopy } from "../letters/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { MessageCopyViewExample } from "./MessageCopyView.gallery.client";

const copy = broadcastsCopy.broadcastPages;
const stateWords = lettersCopy.copyStates;

describe("MessageCopyView", () => {
  it("says over one that never reached them why: refused as it was sent, by what, never sent, or not yet; nothing over one that went", async () => {
    const strip = () => document.querySelector("[data-strip]")?.textContent;
    const { rerender } = await render(<MessageCopyView one={exampleMessageCopy} />);
    expect(strip()).toBeUndefined();
    // Refused by what sends it: WhatsApp for a text, an email's by its own.
    await rerender(
      <MessageCopyView
        one={{ ...exampleMessageCopy, channel: "email", sendBy: "postmark", status: "failed", sentAt: null }}
      />,
    );
    expect(strip()).toBe(copy.notReached.refused(mailingsCopy.mailingPages.sendBy.names.postmark));
    for (const [status, words] of [
      ["failed", copy.notReached.refused(mailingsCopy.mailingPages.sendFacts.whatsApp)],
      ["cancelled", copy.notReached.never(copy.notReached.why.cancelled)],
      ["scheduled", copy.notReached.notYet],
      ["sending", copy.notReached.notYet],
    ] as const) {
      await rerender(<MessageCopyView one={{ ...exampleMessageCopy, status, sentAt: null }} />);
      expect(strip()).toBe(words);
    }
    // Cancelled as its broadcast stopped by itself, an error: why.
    await rerender(
      <MessageCopyView
        one={{ ...exampleMessageCopy, status: "cancelled", state: "error", why: "civicrm", sentAt: null }}
      />,
    );
    expect(strip()).toBe(copy.notReached.never(copy.notReached.why.civicrm));
    // Every way a broadcast stops by itself has its own words, on the copy and its lozenge.
    for (const why of ["late", "failing"]) {
      await rerender(
        <MessageCopyView one={{ ...exampleMessageCopy, status: "cancelled", state: "error", why, sentAt: null }} />,
      );
      expect(strip()).toBe(copy.notReached.never(copy.notReached.why[why]!));
      expect(stateWords.tags[`error:${why}`]).toBeDefined();
    }
    // Skipped, why, as its lozenge says.
    await rerender(
      <MessageCopyView one={{ ...exampleMessageCopy, status: "skipped", skipReason: "blocked", sentAt: null }} />,
    );
    expect(strip()).toBe(copy.notReached.never(copy.notReached.why.blocked));
  });

  it("shows a text as they got it, titled as a letter is, with what its provider reported", async () => {
    const { rerender } = await render(<MessageCopyView one={{ ...exampleMessageCopy, footer: null }} />);
    // A footer we don't know, as for a template made in WhatsApp Manager: none shown.
    await expect.element(page.getByText(/Reply STOP/)).not.toBeInTheDocument();
    await rerender(<MessageCopyView one={exampleMessageCopy} />);
    // Its footer, as its template went to WhatsApp.
    await expect.element(page.getByText(exampleMessageCopy.footer!, { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("heading", { level: 1 }))
      .toHaveTextContent(copy.copyTitle("text", "Jane Example"));
    await expect.element(page.getByText(stateWords.tags.read!, { exact: true }).first()).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "Jane Example", exact: true }))
      .toHaveAttribute("href", "/staff/supporters/7");
    expect(page.getByRole("banner").element().querySelector("p")!.textContent).toBe("Jane Example · Leeds");
    await expect
      .element(page.getByLabelText(copy.threadTitle).getByText(staffTime(exampleMessageCopy.sentAt!)))
      .toBeVisible();
    const history = page.getByRole("list", { name: lettersCopy.letters.detail.historyTitle });
    await expect.element(history.getByText(copy.events.read)).toBeVisible();
    await expect.element(history.getByText(copy.events.sent)).toBeVisible();
    // Its ticks, as far as WhatsApp said it got.
    await expect
      .element(page.getByLabelText(copy.threadTitle).getByRole("img", { name: copy.events.read }))
      .toBeVisible();
  });

  /** Its broadcast with a second version, for those who wrote: other words, a picture and a link button. */
  const withVersion = {
    ...exampleMessageCopy,
    written: {
      ...exampleMessageCopy.written!,
      textVersion: {
        condition: "wrote:regulate-ai",
        body: {
          type: "doc" as const,
          content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: "Thanks for writing" }] }],
        },
        header: "image" as const,
        place: null,
        pictureId: examplePictureId,
        buttons: [{ text: "Details", url: "https://pauseai.uk/march" }],
        variant: exampleVariant(8, null, { status: "draft", approvedAt: null }),
      },
    },
  };
  const thread = () => page.getByLabelText(copy.threadTitle);

  it("shows a text with its broadcast's map and buttons, the version for everyone else to one who didn't meet its condition", async () => {
    await render(<MessageCopyView one={withVersion} />);
    await expect.element(thread().getByText(/the march meets/)).toBeVisible();
    await expect.element(thread().getByText(examplePlace.name, { exact: true })).toBeVisible();
    await expect.element(thread().getByText("I'm coming")).toBeVisible();
    expect(thread().element().querySelector("img[src^='data:']")).toBeNull();
    await expect.element(thread().getByText("Thanks for writing")).not.toBeInTheDocument();
  });

  it("shows one who met the version's condition the version, with its picture and buttons", async () => {
    await render(
      <MessageCopyView
        one={{
          ...withVersion,
          merge: { values: { firstName: "Jane" }, meets: ["has:firstName", "wrote:regulate-ai"] },
        }}
      />,
    );
    await expect.element(thread().getByText("Thanks for writing")).toBeVisible();
    expect(thread().element().querySelector("img")!.getAttribute("src")).toBe(examplePictureId);
    await expect.element(thread().getByText("Details")).toBeVisible();
    await expect.element(thread().getByText("I'm coming")).not.toBeInTheDocument();
    await expect.element(thread().getByText(examplePlace.name, { exact: true })).not.toBeInTheDocument();
  });

  it("shows a text whose broadcast as written is gone as it was sent, with no top or buttons", async () => {
    await render(<MessageCopyView one={{ ...withVersion, written: null }} />);
    await expect.element(thread().getByText(/the march meets/)).toBeVisible();
    await expect.element(thread().getByText(examplePlace.name, { exact: true })).not.toBeInTheDocument();
    expect(thread().element().querySelector("ul")).toBeNull();
  });

  /** The history as a tree: each line's words, its fields, and the lines under it, newest first. */
  type Line = [string, string[], Line[]];
  const tree = (list: Element): Line[] =>
    [...list.children].map((item) => [
      item.querySelector(":scope > p strong")!.textContent!,
      [...item.querySelectorAll(":scope > dl > dd")].map((field) => field.textContent!),
      item.querySelector(":scope > ol") ? tree(item.querySelector(":scope > ol")!) : [],
    ]);
  const history = () => tree(page.getByRole("list", { name: lettersCopy.letters.detail.historyTitle }).element());
  const at = (time: string) => new Date(`2026-11-07T${time}:00Z`);

  it("nests what WhatsApp said under Sent, and under each of our replies; the rest on lines of their own", async () => {
    await render(
      <MessageCopyView
        one={{
          ...exampleMessageCopy,
          events: [
            { at: at("11:00"), kind: "opted-out", details: {} },
            { at: at("07:48"), kind: "replied", details: {} },
            ...exampleMessageCopy.events,
          ],
          replies: [
            { ...exampleTextReplies[0], receivedAt: at("07:48") },
            // Dealt with as nothing to do.
            {
              ...exampleTextReplies[1],
              receivedAt: at("08:00"),
              outcome: "nothing",
              dealtBy: "sam@pauseai.uk",
              dealtAt: at("09:10"),
            },
            // STOP, which the site recorded and answered itself.
            {
              ...exampleTextReplies[1],
              id: 14,
              receivedAt: at("11:00"),
              text: "STOP",
              outcome: "opted-out",
              dealtBy: SITE_ACTOR,
              dealtAt: at("11:00"),
            },
          ],
          answers: [
            {
              ...exampleTextAnswers[0],
              sentAt: at("07:58"),
              events: [
                { at: at("08:03"), kind: "read", details: {} },
                { at: at("07:59"), kind: "delivered", details: {} },
              ],
            },
            // One whose send never finished, so it's no line.
            { ...exampleTextAnswers[0], id: 12, sentAt: null, events: [] },
            // The site's answer to a STOP, with no message ID kept.
            {
              ...exampleTextAnswers[0],
              id: 15,
              replyId: 14,
              sentBy: SITE_ACTOR,
              sentAt: at("11:00"),
              providerId: null,
              events: [],
            },
          ],
        }}
      />,
    );
    const ours = copy.replies.historyAnswered;
    // Who each was from and to, each number as staff pages write it after whose it is: the IDs are in its {}.
    const [us, jane] = [
      copy.replies.numberOf("PauseAI UK", "07700 900000"),
      copy.replies.numberOf("Jane Example", "07700 900001"),
    ];
    expect(history()).toEqual([
      // WhatsApp's opt-out, the STOP and the site's answer to it, at the same moment, in the order they were recorded.
      [copy.events["opted-out"], [], []],
      [copy.events.replied, [jane, us], []],
      [ours, [us, jane, copy.replies.automatically], []],
      [copy.replies.historyNothing, ["sam@pauseai.uk"], []],
      [copy.events.replied, [jane, us], []],
      [
        ours,
        [us, jane, "jo@pauseai.uk"],
        [
          [copy.replies.historyOurs.read!, [], []],
          [copy.replies.historyOurs.delivered!, [], []],
        ],
      ],
      [copy.events.replied, [jane, us], []],
      [
        copy.events.sent,
        [us, jane],
        [
          [copy.events.read, [], []],
          [copy.events.delivered, [], []],
        ],
      ],
    ]);
    // Sent, each of their three replies and each of our two say what they went by, as a letter's do.
    const list = page.getByRole("list", { name: lettersCopy.letters.detail.historyTitle });
    expect(list.getByText(mailingsCopy.mailingPages.sendFacts.whatsApp, { exact: true }).elements()).toHaveLength(6);
    // What's kept of it beside, IDs and all, opens as JSON.
    expect(list.getByRole("button", { name: staffVocabulary.logged.json }).elements().length).toBeGreaterThan(0);
  });

  it("keeps what its provider said on lines of their own when no Sent was recorded, with WhatsApp's why", async () => {
    await render(
      <MessageCopyView
        one={{
          ...exampleMessageCopy,
          // With no names, the numbers alone.
          fromName: "",
          name: null,
          providerId: null,
          events: [{ at: at("07:18"), kind: "failed", details: { code: 131026, title: "Message undeliverable" } }],
          replies: [
            {
              ...exampleTextReplies[1]!,
              receivedAt: at("07:30"),
              outcome: "opted-out",
              dealtBy: "jo@pauseai.uk",
              dealtAt: at("07:40"),
            },
          ],
          answers: [],
        }}
      />,
    );
    expect(history()).toEqual([
      [copy.replies.historyOptedOut, ["jo@pauseai.uk", copy.replies.how], []],
      [copy.events.replied, ["07700 900001", "07700 900000"], []],
      [copy.events.failed, ["131026", "Message undeliverable"], []],
    ]);
    const fields = lettersCopy.letters.detail.fields;
    await expect.element(page.getByText(fields.code!, { exact: true })).toBeVisible();
    await expect.element(page.getByText(fields.title!, { exact: true })).toBeVisible();
  });

  it("tags an email's Sent with what sent it", async () => {
    await render(
      <MessageCopyView
        one={{ ...exampleMessageCopy, channel: "email", sendBy: "postmark", address: "jane@example.com" }}
      />,
    );
    await expect
      .element(
        page
          .getByRole("list", { name: lettersCopy.letters.detail.historyTitle })
          .getByText(mailingsCopy.mailingPages.sendBy.names.postmark, { exact: true }),
      )
      .toBeVisible();
  });

  it("shows an email as a mail app does", async () => {
    const one = {
      ...exampleMessageCopy,
      channel: "email" as const,
      subject: "Thank you",
      sentFrom: "hello@pauseai.uk",
      address: "jane@example.com",
      place: null,
      events: [],
      written: null,
    };
    await render(<MessageCopyView one={one} />);
    await expect
      .element(page.getByRole("heading", { level: 1 }))
      .toHaveTextContent(copy.copyTitle("email", "Jane Example"));
    await expect.element(page.getByRole("article", { name: "Thank you" })).toBeVisible();
    await expect.element(page.getByText(examplePlace.name, { exact: true })).not.toBeInTheDocument();
    await expect.element(page.getByText(lettersCopy.letters.detail.noHistory)).toBeVisible();
  });

  it("keeps only that one was sent, once they're erased", async () => {
    const one = {
      ...exampleMessageCopy,
      supporterId: null,
      name: null,
      address: null,
      merge: null,
      place: null,
      status: "skipped",
      skipReason: "blocked",
      sentAt: null,
      events: [],
    };
    await render(<MessageCopyView one={one} />);
    await expect
      .element(page.getByRole("heading", { level: 1 }))
      .toHaveTextContent(copy.copyTitle("text", copy.erased));
    await expect.element(page.getByRole("link", { name: copy.erased })).not.toBeInTheDocument();
    await expect.element(page.getByText(`Hi {${copy.fieldWords.firstName}}`, { exact: false })).toBeVisible();
  });

  it("names someone with none", async () => {
    await render(<MessageCopyView one={{ ...exampleMessageCopy, name: null, channel: "email", address: null }} />);
    await expect
      .element(page.getByRole("heading", { level: 1 }))
      .toHaveTextContent(copy.copyTitle("email", supportersCopy.supporters.noName));
  });
});

describe("MessageCopyView's example in the gallery", () => {
  it("draws a text, an email, and an email with its replies", async () => {
    await render(
      <>
        <MessageCopyViewExample />
        <MessageCopyViewExample email />
        <MessageCopyViewExample email replies />
      </>,
    );
    await expect.element(page.getByText("Thank you for marching").first()).toBeVisible();
  });

  it("logs what a reply is recorded as", async () => {
    await render(<MessageCopyViewExample email replies />);
    await page.getByRole("button", { name: copy.replies.nothing }).click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent('deal({"replyId":"1","decision":"nothing"})');
  });

  it("puts WhatsApp's failure of our emoji under it in the history", async () => {
    await render(<MessageCopyView one={{ ...exampleMessageCopy, reactions: [exampleUndeliveredReaction] }} />);
    const history = page.getByRole("list", { name: lettersCopy.letters.detail.historyTitle });
    await expect.element(history.getByText(copy.replies.historyReacted("🙏"))).toBeVisible();
    await expect.element(history.getByText(copy.replies.historyOurs.failed!)).toBeVisible();
  });

  it("says an answer written in Gmail was sent there, by the mailbox", async () => {
    await render(<MessageCopyViewExample email replies gmail />);
    await expect.element(page.getByText(copy.replies.sentInGmail("hello@pauseai.uk"))).toBeVisible();
  });

  it("puts the smiley beside their latest message only, ours on it, each of ours in the history", async () => {
    await render(<MessageCopyViewExample reacted />);
    // Their thanks; not their question before it.
    expect(page.getByRole("button", { name: copy.replies.react }).all()).toHaveLength(1);
    const history = page.getByRole("list", { name: lettersCopy.letters.detail.historyTitle });
    await expect.element(history.getByText(copy.replies.historyReacted("👍"))).toBeVisible();
    await expect.element(history.getByText(copy.replies.historyReacted("❤️"))).toBeVisible();
    await page.getByRole("button", { name: copy.replies.react }).click();
    await expect.element(page.getByRole("button", { name: "👍", pressed: true })).toBeVisible();
    await page.getByRole("button", { name: "🙏" }).click();
    await expect
      .element(page.getByRole("list", { name: "Event log" }).getByRole("listitem"))
      .toHaveTextContent('react(12, "🙏")');
  });
});
