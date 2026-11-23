import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import LetterThread, { SupporterLetterThread } from "./LetterThread";
import {
  exampleAutoRepliedLetterDetails,
  exampleProxiedLetterDetails,
  exampleSupporterLetterDetails,
} from "./LettersTable.examples";
import { lettersCopy } from "./copy";
import type { LetterDoc } from "@/lib/letters/format";
import { gmailMessageLink } from "@/lib/email/gmail-links";
import { MailingLetter } from "../mailings/MailingLetter";
import { exampleImportedThread, exampleThread } from "./LetterThread.examples";

/** A mailing's letter as it reads, as its page shows it. */
const showLetter = (letter: LetterDoc) => <MailingLetter doc={letter} />;
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("SupporterLetterThread", () => {
  const copy = lettersCopy.letterThread;
  const letter = exampleSupporterLetterDetails;
  const headers = () =>
    [...document.querySelectorAll("article dt")].map((name) => [
      name.textContent,
      name.nextElementSibling!.textContent,
    ]);

  it("shows the letter as an email, from the sender, leading to their supporter page, saying its text is in Gmail", async () => {
    await render(<SupporterLetterThread letter={letter} link={<a href="#gmail">Gmail</a>} />);
    await expect.element(page.getByRole("heading", { level: 2, name: copy.title })).toBeVisible();
    // The way to it in Gmail beside the note, in the letter's place.
    await expect.element(page.getByRole("article").getByRole("link", { name: "Gmail" })).toBeVisible();
    expect(headers()).toEqual([
      [copy.headers.from, "Jane Smith <jane@example.com>"],
      [copy.headers.to, "Testy McTestface MP <testy.mctestface.mp@parliament.uk>"],
      [copy.headers.date, "12 Oct 2026, 10:05"],
      [copy.headers.subject, letter.subject],
    ]);
    await expect
      .element(page.getByRole("link", { name: "Jane Smith <jane@example.com>" }))
      .toHaveAttribute("href", "/staff/supporters/7");
    await expect.element(page.getByText(copy.supporterNoText)).toBeVisible();
  });

  it("one from the letters inbox: Open in Gmail, its changes to the draft, then each message both ways, any Cc", async () => {
    await render(<SupporterLetterThread letter={exampleProxiedLetterDetails} link={<a href="#gmail">Gmail</a>} />);
    // Its text is here, so there's no search for it in Gmail; it went by Gmail, so it opens there, in the letters inbox.
    await expect.element(page.getByRole("article").first()).toBeVisible();
    expect(page.getByRole("link", { name: "Gmail", exact: true }).all()).toHaveLength(0);
    await expect
      .element(page.getByRole("link", { name: lettersCopy.lettersInbox.openInGmail }))
      .toHaveAttribute("href", gmailMessageLink("fixture-letters@pauseai.uk", "thread-letter-1"));
    const [, reply, answer] = page.getByRole("article").all();
    await expect.element(reply.getByText("Thank you for writing to me.", { exact: false })).toBeVisible();
    // The office's reply is to Jane; her answer, to the MP.
    expect(reply.element().textContent).toContain(`${copy.headers.to}Jane Smith <jane@example.com>`);
    expect(answer.element().textContent).toContain(
      `${copy.headers.to}Testy McTestface MP <testy.mctestface.mp@parliament.uk>`,
    );
    // Whom the office copied in, under To; her answer copied nobody.
    expect(reply.element().textContent).toContain(`${copy.headers.cc}Casey Worker <casey.worker@parliament.uk>`);
    expect(answer.element().textContent).not.toContain(copy.headers.cc);
    await expect.element(page.getByRole("button", { name: lettersCopy.letterChanges.asSent })).toBeVisible();
  });

  it("folds an automatic reply to its first paragraph, unfolded and folded again by a click", async () => {
    await render(<SupporterLetterThread letter={exampleAutoRepliedLetterDetails} />);
    const [, acknowledgement, away] = page.getByRole("article").all();
    await expect.element(acknowledgement.getByText("Thank you for contacting me.", { exact: false })).toBeVisible();
    const office = acknowledgement.getByText("constituency office", { exact: false });
    await expect.element(office).not.toBeVisible();
    const fold = acknowledgement.getByText(copy.autoInFull);
    await fold.click();
    await expect.element(office).toBeVisible();
    await fold.click();
    await expect.element(office).not.toBeVisible();
    // One of a single paragraph, whole, with nothing to unfold.
    expect(away.element().textContent).toContain("I'm away until Monday.");
    expect(away.element().querySelector("details")).toBeNull();
  });

  it("shows the replies kept of a letter whose own text isn't", async () => {
    await render(<SupporterLetterThread letter={{ ...exampleProxiedLetterDetails, sent: null, gmail: null }} />);
    await expect.element(page.getByText(copy.supporterNoText)).toBeVisible();
    await expect.element(page.getByText(exampleProxiedLetterDetails.messages[0].subject).first()).toBeVisible();
  });

  it("a message whose text can't be read says so", async () => {
    const [first] = exampleProxiedLetterDetails.messages;
    await render(
      <SupporterLetterThread letter={{ ...exampleProxiedLetterDetails, messages: [{ ...first, text: null }] }} />,
    );
    await expect.element(page.getByText(copy.unreadable)).toBeVisible();
  });

  it("one not yet a supporter's, never sent, with no subject: unlinked, undated, by its campaign", async () => {
    await render(
      <SupporterLetterThread
        letter={{ ...letter, supporterId: null, sentAt: null, subject: "", mpEmail: null, ownWords: null }}
      />,
    );
    expect(headers()).toEqual([
      [copy.headers.from, "Jane Smith <jane@example.com>"],
      [copy.headers.to, "Testy McTestface MP"],
      [copy.headers.subject, letter.campaignTitle],
    ]);
    expect(page.getByRole("link").all()).toHaveLength(0);
  });
});

describe("a letter's imported text", () => {
  it("says a letter's text is approximate on its page", async () => {
    await render(<LetterThread showLetter={showLetter} thread={{ ...exampleThread, approximate: true }} />);
    await says(lettersCopy.letterThread.approximate);
  });
});

describe("LetterThread", () => {
  const copy = lettersCopy.letterThread;
  /** Each email's headers, as name and value pairs. */
  const headers = () =>
    [...document.querySelectorAll("article dl")].map((list) =>
      [...list.querySelectorAll("dt")].map((name) => [name.textContent, name.nextElementSibling!.textContent]),
    );

  it("shows each message as an email: the letter from the Gmail it went from, then each reply and answer", async () => {
    await render(<LetterThread showLetter={showLetter} thread={exampleThread} />);
    await expect.element(page.getByRole("heading", { level: 2, name: copy.title })).toBeVisible();
    const polly = "Polly Placeholder <polly.placeholder.mp@parliament.uk>";
    expect(headers()).toEqual([
      [
        [copy.headers.from, "Jo Seed <jo@pauseai.uk>"],
        [copy.headers.to, polly],
        [copy.headers.date, "9 Oct 2026, 10:00"],
        [copy.headers.subject, "Edinburgh follow-up"],
      ],
      [
        [copy.headers.from, polly],
        [copy.headers.to, "Jo Seed <jo@pauseai.uk>"],
        [copy.headers.date, "10 Oct 2026, 10:00"],
        [copy.headers.subject, "Re: Edinburgh follow-up"],
      ],
      [
        [copy.headers.from, "Jo Seed <jo@pauseai.uk>"],
        [copy.headers.to, polly],
        [copy.headers.date, "10 Oct 2026, 12:30"],
        [copy.headers.subject, "Re: Edinburgh follow-up"],
      ],
    ]);
    // The letter's words; the reply's quote of them is folded under it.
    await expect.element(page.getByText("Will you come and meet us?").first()).toBeVisible();
    await expect.element(page.getByText(/I'd be glad to meet/)).toBeVisible();
    await expect.element(page.getByText(copy.unreadable)).toBeVisible();
    expect(page.getByText(copy.noReplies).query()).toBeNull();
  });

  it("has no way to it in Gmail when it has the letter's text", async () => {
    await render(<LetterThread showLetter={showLetter} thread={exampleThread} link={<a href="#gmail">Gmail</a>} />);
    await expect.element(page.getByRole("article").first()).toBeVisible();
    expect(page.getByRole("link", { name: "Gmail", exact: true }).all()).toHaveLength(0);
  });

  it("opens in Gmail from its heading when Gmail sent it, at its thread in the mailbox it went from", async () => {
    const { rerender } = await render(<LetterThread showLetter={showLetter} thread={exampleThread} />);
    const open = page.getByRole("link", { name: lettersCopy.lettersInbox.openInGmail });
    await expect.element(open).toHaveAttribute("href", gmailMessageLink("jo@pauseai.uk", "thread-seed-2"));
    await rerender(<LetterThread showLetter={showLetter} thread={exampleImportedThread} />);
    expect(open.query()).toBeNull();
  });

  it("names someone with no name by their address", async () => {
    const reply = { ...exampleThread.messages[0], fromName: "" };
    await render(
      <LetterThread showLetter={showLetter} thread={{ ...exampleThread, fromName: "", messages: [reply] }} />,
    );
    expect(headers()[1][0]).toEqual([copy.headers.from, "polly.placeholder.mp@parliament.uk"]);
    expect(headers()[0][0]).toEqual([copy.headers.from, "jo@pauseai.uk"]);
  });

  it("names who a letter's from alone when it has a name and no address", async () => {
    await render(<LetterThread showLetter={showLetter} thread={{ ...exampleImportedThread, fromName: "Joseph" }} />);
    expect(headers()[0][0]).toEqual([copy.headers.from, "Joseph"]);
  });

  it("says an imported letter's text isn't here, and that nothing's come back", async () => {
    await render(
      <LetterThread
        showLetter={showLetter}
        thread={{ ...exampleImportedThread, subject: "", to: { name: "Polly Placeholder", email: null } }}
        link={<a href="#gmail">Gmail</a>}
      />,
    );
    await expect.element(page.getByText(copy.noText)).toBeVisible();
    // The way to it in Gmail beside the note, in the letter's place, not by the heading.
    await expect.element(page.getByRole("article").getByRole("link", { name: "Gmail" })).toBeVisible();
    expect(page.getByRole("link", { name: "Gmail" }).all()).toHaveLength(1);
    await expect.element(page.getByText(copy.noReplies)).toBeVisible();
    expect(headers()).toEqual([
      [
        [copy.headers.from, lettersCopy.letters.fromPauseai],
        [copy.headers.to, "Polly Placeholder"],
        [copy.headers.subject, exampleThread.mailingTitle],
      ],
    ]);
  });
});
