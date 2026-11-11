import { describe, expect, it } from "vitest";
import { forwardedMessages } from "./forwards";

// Forwards as Apple Mail, Gmail and Outlook write them, each carrying a
// supporter's letter to their MP and the MP's answer.

const APPLE = [
  "Sent from my iPhone",
  "",
  "Begin forwarded message:",
  "",
  "From: Polly Placeholder MP <polly.placeholder.mp@parliament.uk>",
  "Date: 21 October 2026 at 12:13:11 BST",
  "To: Jane Smith <jane.smith@example.com>",
  "Subject: Re: Can we meet? (Case Ref: PP1)",
  "",
  "",
  "Dear Jane,",
  "",
  "Thank you for writing.",
  "",
  "Polly",
  "",
  "________________________________",
  "From: Jane Smith < jane.smith@example.com >",
  "Sent: 20 October 2026 11:17",
  "To: polly.placeholder.mp@parliament.uk",
  "Subject: Re: Can we meet?",
  "",
  "Dear Polly,",
  "",
  "Just following up.",
  "",
  "On 20 Oct 2026, at 02:49, Jane Smith <jane.smith@example.com> wrote:",
  "",
  "Dear Polly,",
  "Could we meet?",
].join("\n");

const GMAIL = [
  "---------- Forwarded message ---------",
  "From: Polly Placeholder MP <pollyplaceholdermp@parliament.uk>",
  "Date: Wed, Nov 4, 2026 at 12:31 PM",
  "Subject: Re: The lobby",
  "To: <jane.smith@example.com>, < john.doe@example.com>",
  "",
  "Dear Jane and John,",
  "",
  "It was good to meet you.",
  "",
  "On Mon, Oct 19, 2026 at 3:38 PM Jane Smith <",
  "jane.smith@example.com> wrote:",
  "",
  "> Hi, yes please.",
  ">",
  "> Jane",
  "",
  "On Mon, Oct 19, 2026 at 12:39 PM pollyplaceholdermp@parliament.uk wrote:",
  "> Dear Jane, she's busy.",
].join("\n");

describe("a forward's messages", () => {
  it("splits Apple Mail's forward of an Outlook thread into the note and each message, newest first", () => {
    const split = forwardedMessages(APPLE, "Fwd: Re: Can we meet? (Case Ref: PP1)");
    expect(split?.own).toBe("Sent from my iPhone");
    expect(split?.forwarded).toEqual([
      {
        from: "Polly Placeholder MP <polly.placeholder.mp@parliament.uk>",
        to: "Jane Smith <jane.smith@example.com>",
        cc: "",
        sent: "21 October 2026 at 12:13:11 BST",
        subject: "Re: Can we meet? (Case Ref: PP1)",
        body: "Dear Jane,\n\nThank you for writing.\n\nPolly",
      },
      {
        from: "Jane Smith < jane.smith@example.com >",
        to: "polly.placeholder.mp@parliament.uk",
        cc: "",
        sent: "20 October 2026 11:17",
        subject: "Re: Can we meet?",
        body: "Dear Polly,\n\nJust following up.",
      },
      {
        from: "Jane Smith <jane.smith@example.com>",
        to: "",
        cc: "",
        sent: "20 Oct 2026, at 02:49",
        subject: "Re: Can we meet?",
        body: "Dear Polly,\nCould we meet?",
      },
    ]);
  });

  it("reads Gmail's forward, a wrapped On … wrote: line and quoting marks, with nothing over it", () => {
    const split = forwardedMessages(GMAIL, "Fwd: Re: The lobby");
    expect(split?.own).toBe("");
    expect(split?.forwarded.map(({ from, sent, subject, body }) => ({ from, sent, subject, body }))).toEqual([
      {
        from: "Polly Placeholder MP <pollyplaceholdermp@parliament.uk>",
        sent: "Wed, Nov 4, 2026 at 12:31 PM",
        subject: "Re: The lobby",
        body: "Dear Jane and John,\n\nIt was good to meet you.",
      },
      {
        from: "Jane Smith <jane.smith@example.com>",
        sent: "Mon, Oct 19, 2026 at 3:38 PM",
        subject: "Re: The lobby",
        body: "Hi, yes please.\n\nJane",
      },
      {
        from: "pollyplaceholdermp@parliament.uk",
        sent: "Mon, Oct 19, 2026 at 12:39 PM",
        subject: "Re: The lobby",
        body: "Dear Jane, she's busy.",
      },
    ]);
  });

  it("reads Thunderbird's forward, its Subject and Date over its From", () => {
    const text = [
      "FYI",
      "",
      "-------- Forwarded Message --------",
      "Subject: Our answer",
      "Date: Thu, 22 Oct 2026 10:00:00 +0100",
      "From: Polly Placeholder <polly.placeholder.mp@parliament.uk>",
      "To: jane.smith@example.com",
      "Cc: policy@pauseai.uk",
      "",
      "Thanks.",
    ].join("\n");
    expect(forwardedMessages(text, "Fwd: Our answer")).toEqual({
      own: "FYI",
      forwarded: [
        {
          from: "Polly Placeholder <polly.placeholder.mp@parliament.uk>",
          to: "jane.smith@example.com",
          cc: "policy@pauseai.uk",
          sent: "Thu, 22 Oct 2026 10:00:00 +0100",
          subject: "Our answer",
          body: "Thanks.",
        },
      ],
    });
  });

  it("finds a forward by its mark when the subject doesn't say, and takes a quote with no subject the forward's", () => {
    const text = "-----Original Message-----\nFrom: a@example.com\nSent: today\n\nHello";
    expect(forwardedMessages(text, "Meeting")?.forwarded).toEqual([
      { from: "a@example.com", to: "", cc: "", sent: "today", subject: "", body: "Hello" },
    ]);
    expect(forwardedMessages("On a day x@example.com wrote:\nHi", "Fwd: hello")?.forwarded[0]).toMatchObject({
      from: "x@example.com",
      sent: "a day",
      subject: "Fwd: hello",
    });
  });

  it("splits nothing that isn't a forward, or carries no message", () => {
    expect(
      forwardedMessages("On Mon, Oct 19, 2026 at 3:38 PM a@example.com wrote:\n> Hi", "Re: hello"),
    ).toBeUndefined();
    expect(forwardedMessages("Just a note, nothing quoted.", "Fwd: hello")).toBeUndefined();
  });

  it("isn't fooled by a From line without a date, a field twice, or an On line that isn't one", () => {
    const text = [
      "From: someone, about the bill",
      "",
      "On reflection, nothing.",
      "From: a@example.com",
      "From: b@example.com",
      "Sent: today",
      "",
      "Body",
    ].join("\n");
    expect(forwardedMessages(text, "Fwd: notes")).toEqual({
      own: "From: someone, about the bill\n\nOn reflection, nothing.\nFrom: a@example.com",
      forwarded: [{ from: "b@example.com", to: "", cc: "", sent: "today", subject: "", body: "Body" }],
    });
  });
});
