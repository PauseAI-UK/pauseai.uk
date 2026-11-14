import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffTime } from "@/lib/staff-time";
import MessageCopyView from "./MessageCopyView";
import { exampleMessageCopy } from "./BroadcastWriter.examples";
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
    };
    await render(<MessageCopyView one={one} />);
    await expect
      .element(page.getByRole("heading", { level: 1 }))
      .toHaveTextContent(copy.copyTitle("email", "Jane Example"));
    await expect.element(page.getByRole("article", { name: "Thank you" })).toBeVisible();
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
});
