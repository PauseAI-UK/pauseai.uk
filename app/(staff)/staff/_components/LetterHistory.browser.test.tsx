import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page, type Locator } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { historyOf, LetterHistory } from "./LetterHistory";
import {
  exampleOlderRepliedLetterDetails,
  examplePauseaiLetterDetails,
  exampleRepliedLetterDetails,
  exampleSupporterLetterDetails,
} from "./LettersTable.examples";

describe("LetterHistory", () => {
  const copy = staffCopy.letters;
  const history = () => page.getByRole("list", { name: copy.detail.historyTitle });

  it("shows each change newest first, in words, Sent tagged with what sent it, with a {} for those that recorded anything", async () => {
    await render(<LetterHistory events={historyOf(exampleSupporterLetterDetails)} />);
    const [bounced, sent, sending] = history().getByRole("listitem").all();
    expect(sending.element().textContent).toContain(copy.status.sending);
    expect(sending.getByRole("button").all()).toHaveLength(0);
    // Sent says Postmark; its ID is only in its {}.
    await expect.element(sent.getByText(copy.backends.postmark)).toBeVisible();
    expect(sent.element().querySelector("dl")).toBeNull();
    // A hard bounce says no more than its status; the {} has what Postmark said.
    expect(bounced.element().querySelector("strong")!.textContent).toBe(copy.status.bounced);
    expect(bounced.element().querySelector("dl")).toBeNull();
    await bounced.getByRole("button", { name: staffCopy.changes.json }).click();
    await expect.element(page.getByText('"type": "HardBounce"', { exact: false })).toBeVisible();
  });

  it("puts a reason, a notice and an uncertain match in words, and a reason it doesn't know as recorded", async () => {
    await render(
      <LetterHistory
        events={[
          { at: new Date("2026-10-14T10:00:00Z"), status: "queued", details: { reason: "daily_limit" } },
          {
            at: new Date("2026-10-13T10:00:00Z"),
            status: "notice",
            details: { notice: "bounced", to: "jane@example.com" },
          },
          {
            at: new Date("2026-10-12T10:00:00Z"),
            status: "replied",
            details: { uncertain: true, reason: "odd", notice: "odd" },
          },
        ]}
      />,
    );
    const [queued, notice, replied] = history().getByRole("listitem").all();
    expect(queued.element().textContent).toContain(`${copy.detail.fields.reason}${copy.detail.reasons.daily_limit}`);
    expect(notice.element().textContent).toContain(`${copy.detail.fields.notice}${copy.detail.notices.bounced}`);
    expect(replied.element().textContent).toContain(`${copy.detail.fields.uncertain}${copy.detail.uncertainLetter}`);
    expect(replied.element().textContent).toContain(`${copy.detail.fields.reason}odd`);
  });

  it("says what Gmail said when it refused a letter, as it said it", async () => {
    await render(
      <LetterHistory
        events={[{ at: new Date("2026-10-14T10:00:00Z"), status: "failed", details: { detail: "Invalid To header" } }]}
      />,
    );
    expect(history().getByRole("listitem").element().textContent).toContain(
      `${copy.detail.fields.detail}Invalid To header`,
    );
  });

  it("puts each reply's relay under it, and the copy under the Sent it went with, and leaves the rest where they were", async () => {
    const letter = {
      ...exampleSupporterLetterDetails,
      sentAt: null,
      events: [
        {
          at: new Date("2026-10-14T11:00:00Z"),
          status: "relayed",
          details: { to: "jane@example.com", gmailMessageId: "m1" },
        },
        {
          at: new Date("2026-10-14T10:30:00Z"),
          status: "relay_held",
          details: { reason: "blocked", gmailMessageId: "m1" },
        },
        {
          at: new Date("2026-10-14T10:00:00Z"),
          status: "replied",
          details: { from: "mp@example.org", gmailMessageId: "m1" },
        },
        { at: new Date("2026-10-13T10:00:00Z"), status: "bounced", details: { gmailMessageId: "bounce" } },
        { at: new Date("2026-10-12T10:00:00Z"), status: "replied", details: { from: "mp@example.org" } },
        { at: new Date("2026-10-11T10:05:00Z"), status: "copy_bounced", details: {} },
        { at: new Date("2026-10-11T10:00:00Z"), status: "sent", details: {} },
        // Sent again after a bounce: a copy goes under the Sent before it.
        { at: new Date("2026-10-10T10:01:00Z"), status: "copy_sent", details: {} },
        { at: new Date("2026-10-10T10:00:00Z"), status: "sent", details: {} },
        // Recorded a moment before its Sent: under the first.
        { at: new Date("2026-10-10T09:59:00Z"), status: "copy_held", details: {} },
      ],
    };
    await render(<LetterHistory events={historyOf(letter)} />);
    const items = history().element().querySelectorAll(":scope > li");
    const head = (item: Element) => item.querySelector("strong")!.textContent;
    expect([...items].map(head)).toEqual([
      copy.status.replied,
      copy.status.bounced,
      copy.status.replied,
      copy.status.sent,
      copy.status.sent,
    ]);
    const under = (item: Element) => [...item.querySelectorAll("ol > li")].map(head);
    expect(under(items[0])).toEqual([copy.status.relayed, copy.status.relay_held]);
    expect(items[1].querySelector("ol")).toBeNull();
    expect(items[2].querySelector("ol")).toBeNull();
    expect(under(items[3])).toEqual([copy.status.copy_bounced]);
    expect(under(items[4])).toEqual([copy.status.copy_sent, copy.status.copy_held]);
    // A notice to the supporter under what it tells of: the letter's bounce, a relay's (beside it, under its
    // reply), the letter or a relay gone again; one of nothing before it, or of something else, stays.
    const notice = (at: string, kind: string) => ({ at: new Date(at), status: "notice", details: { notice: kind } });
    const told = historyOf({
      ...letter,
      events: [
        notice("2026-10-16T10:01:00Z", "resent"),
        { at: new Date("2026-10-16T10:00:00Z"), status: "relayed", details: { gmailMessageId: "m2" } },
        notice("2026-10-15T10:01:00Z", "bounced"),
        { at: new Date("2026-10-15T10:00:00Z"), status: "relay_bounced", details: { gmailMessageId: "m2" } },
        { at: new Date("2026-10-14T10:00:00Z"), status: "replied", details: { gmailMessageId: "m2" } },
        notice("2026-10-13T10:01:00Z", "resent"),
        { at: new Date("2026-10-13T10:00:00Z"), status: "sent", details: {} },
        notice("2026-10-12T10:01:00Z", "bounced"),
        { at: new Date("2026-10-12T10:00:00Z"), status: "bounced", details: {} },
        notice("2026-10-11T10:00:00Z", "odd"),
        notice("2026-10-10T10:00:00Z", "bounced"),
      ],
    });
    expect(told.map((e) => [e.status, e.under?.map((u) => `${u.status} ${u.details.notice ?? ""}`.trim())])).toEqual([
      ["replied", ["notice resent", "relayed", "notice bounced", "relay_bounced"]],
      ["sent", ["notice resent"]],
      ["bounced", ["notice bounced"]],
      ["notice", undefined],
      ["notice", undefined],
    ]);
    // One saying it bounced too long ago to go again, under that bounce.
    const notResent = historyOf({
      ...letter,
      events: [
        notice("2026-10-19T10:00:00Z", "notResent"),
        { at: new Date("2026-10-12T10:00:00Z"), status: "bounced", details: {} },
      ],
    });
    expect(notResent.map((e) => [e.status, e.under?.map((u) => u.details.notice)])).toEqual([
      ["bounced", ["notResent"]],
    ]);
    // With no Sent at all, a copy stays where it was.
    const copyOnly = { at: new Date("2026-10-10T10:00:00Z"), status: "copy_held", details: {} };
    expect(historyOf({ ...letter, events: [copyOnly] })).toEqual([copyOnly]);
  });

  it("puts each field a line, by name, in words where it has them; a status nobody knows as stored", async () => {
    await render(
      <LetterHistory
        events={[
          { at: new Date("2026-10-14T10:00:00Z"), status: "replied", details: { subject: "Thanks", spam: 0.1 } },
          {
            at: new Date("2026-10-12T10:00:00Z"),
            status: "bounced",
            details: { type: "SoftBounce", email: "jo@example.org" },
          },
          { at: new Date("2026-10-12T09:00:00Z"), status: "odd", details: {} },
        ]}
      />,
    );
    // One with no name in the copy as recorded, a value that isn't words as JSON, a soft bounce in words,
    // and the address leading to it among the blocked emails.
    const fields = [...history().element().querySelectorAll("dl")].map((list) =>
      [...list.querySelectorAll("dt")].map((name) => [name.textContent, name.nextElementSibling!.textContent]),
    );
    expect(fields).toEqual([
      [
        [copy.detail.fields.subject, "Thanks"],
        ["spam", "0.1"],
      ],
      [
        [copy.detail.fields.type, "Soft bounce"],
        [copy.detail.fields.email, "jo@example.org"],
      ],
    ]);
    await expect
      .element(history().getByRole("link", { name: "jo@example.org" }))
      .toHaveAttribute("href", "/staff/politicians/addresses-to-fix?q=jo%40example.org");
    await expect.element(page.getByText("odd", { exact: true })).toBeVisible();
  });

  it("shows who each reply and the letter were to, and under each reply what was done with it and why", async () => {
    await render(<LetterHistory events={historyOf(exampleRepliedLetterDetails)} />);
    const lists = (item: Locator) =>
      [...item.element().querySelectorAll("dl")].map((list) =>
        [...list.querySelectorAll("dt")].map((name) => [name.textContent, name.nextElementSibling!.textContent]),
      );
    const [followUp, reply, auto, sent] = history().getByRole("listitem").all();
    const why = copy.detail.handlingReasons;
    const done = copy.detail.handling;
    expect(lists(followUp)).toEqual([
      [
        [copy.detail.fields.from, "jane@example.com"],
        [copy.detail.fields.name, "Jane Smith"],
        [copy.detail.fields.to, "testy.mctestface.mp@parliament.uk, jane.smith.482913@letters.pauseai.uk"],
      ],
      [
        [done.forwarded, `policy@pauseai.uk · 14 Oct 2026, 09:00${why.policy_inbox}`],
        [done.not_forwarded, `jane@example.com${why.own_follow_up}`],
      ],
    ]);
    expect(lists(reply)[0]).toContainEqual([copy.detail.fields.cc, "caseworker@parliament.uk"]);
    expect(lists(reply)[0]).toContainEqual([copy.detail.fields.replyTo, "testy.mctestface.mp@parliament.uk"]);
    expect(lists(reply)[1]).toEqual([
      [done.forwarded, `policy@pauseai.uk · 13 Oct 2026, 09:00${why.policy_inbox}`],
      [done.forwarded, `jane@example.com · 13 Oct 2026, 09:00${why.sender}`],
    ]);
    // One that went to no one has no one to name; the bounce's ID is only in its {}.
    expect(lists(auto)).toEqual([
      [[copy.detail.fields.from, "testy.mctestface.mp@parliament.uk"]],
      [[done.nowhere, why.bounce_address]],
    ]);
    expect(lists(sent)).toEqual([
      [
        [copy.detail.fields.from, "jane.smith.482913@letters.pauseai.uk"],
        [copy.detail.fields.to, "testy.mctestface.mp@parliament.uk"],
        [copy.detail.fields.cc, "jane@example.com"],
      ],
    ]);
  });

  it("for replies recorded before what was done with them was, the forwards logged, a failed one with why", async () => {
    await render(<LetterHistory events={historyOf(exampleOlderRepliedLetterDetails)} />);
    const handling = (item: Locator) =>
      [...item.element().querySelectorAll("dl:nth-of-type(2) dt")].map((name) => [
        name.textContent,
        name.nextElementSibling!.textContent,
      ]);
    const [followUp, reply, auto] = history().getByRole("listitem").all();
    const done = copy.detail.handling;
    expect(handling(followUp)).toEqual([[done.forwarded, "policy@pauseai.uk · 14 Oct 2026, 09:00"]]);
    expect(handling(reply)).toEqual([
      [done.forwarded, "policy@pauseai.uk · 13 Oct 2026, 09:00"],
      [done.failed, `jane@example.com${copy.detail.handlingReasons.blocked}`],
    ]);
    // Nothing was logged between the automatic reply and the next.
    expect(handling(auto)).toEqual([]);
  });

  it("puts who it was from and to first, in an email's order, however the database kept them", async () => {
    const details = {
      cc: "c@example.com",
      spam: 1,
      to: "t@example.com",
      replyTo: "r@example.com",
      from: "f@example.com",
    };
    await render(<LetterHistory events={[{ at: new Date("2026-10-14T10:00:00Z"), status: "replied", details }]} />);
    const names = [...history().element().querySelectorAll("dt")].map((name) => name.textContent);
    const fields = copy.detail.fields;
    expect(names).toEqual([fields.from, fields.to, fields.cc, fields.replyTo, "spam"]);
  });

  it("for a logged forward Postmark refused, says so", () => {
    const [, reply] = historyOf({
      ...exampleOlderRepliedLetterDetails,
      forwards: [{ at: new Date("2026-10-13T09:00:01Z"), address: "policy@pauseai.uk", outcome: "failed" }],
    });
    expect(reply.handling).toEqual([{ outcome: "failed", to: "policy@pauseai.uk", reason: "refused" }]);
  });

  it("says when nothing's recorded", async () => {
    await render(<LetterHistory events={[]} />);
    await expect.element(page.getByText(copy.detail.noHistory)).toBeVisible();
  });
});

describe("historyOf", () => {
  const copy = staffCopy.letters;
  const airtable = { ...exampleSupporterLetterDetails, backend: "airtable" as const, events: [] };
  const sentByGmail = { at: new Date("2026-10-01T12:00:00Z"), status: "sent", details: {} };

  it("tags each email with what its own event recorded sent it, whatever sent the letter", () => {
    const events = [
      {
        at: new Date("2026-10-14T10:00:00Z"),
        status: "relayed",
        details: { to: "jane@example.com", backend: "gmail" },
      },
      {
        at: new Date("2026-10-13T10:00:00Z"),
        status: "notice",
        details: { to: "jane@example.com", backend: "postmark" },
      },
      { at: new Date("2026-10-12T10:00:00Z"), status: "replied", details: { backend: "postmark" } },
      // A reply recorded before replies said what brought them: what the letter went by, which they came back through.
      { at: new Date("2026-10-11T10:00:00Z"), status: "auto_reply", details: {} },
      { at: new Date("2026-10-10T10:00:00Z"), status: "bounced", details: {} },
    ];
    expect(historyOf({ ...exampleSupporterLetterDetails, backend: "gmail", events }).map((e) => e.tag)).toEqual([
      copy.backends.gmail,
      copy.backends.postmark,
      copy.backends.postmark,
      copy.backends.gmail,
      // And Sent, from the letter's own send, as it has no event of its own, in its place.
      copy.backends.gmail,
      undefined,
    ]);
    // One Airtable sent heard nothing back through it: an old reply says nothing of what brought it.
    expect(historyOf({ ...airtable, sentAt: null, events: [events[3]] }).map((e) => e.tag)).toEqual([undefined]);
  });

  it("is the changes recorded, Sent tagged with what sent it; nothing more for one never sent", () => {
    const [bounced, sent, sending] = exampleSupporterLetterDetails.events;
    expect(historyOf(exampleSupporterLetterDetails)).toEqual([
      bounced,
      { ...sent, tag: copy.backends.postmark },
      sending,
    ]);
    // One of this site's never sent: no backend, no Sent.
    const notSent = [{ at: new Date("2026-10-12T09:00:00Z"), status: "not_sent", details: {} }];
    expect(historyOf({ ...airtable, backend: null, sentAt: null, events: notSent })).toEqual(notSent);
    // PauseAI's, sent from Gmail.
    expect(historyOf({ ...examplePauseaiLetterDetails, backend: "gmail", events: [sentByGmail] })).toEqual([
      { ...sentByGmail, tag: copy.backends.gmail },
    ]);
    // A send recorded when nothing says what sent it, untagged.
    expect(historyOf({ ...examplePauseaiLetterDetails, backend: null, events: [sentByGmail] })).toEqual([sentByGmail]);
  });

  it("for one copied from Airtable: sent when it says, and written, if earlier and nothing's recorded", () => {
    expect(
      historyOf({ ...airtable, createdAt: new Date("2026-09-30T18:00:00Z"), sentAt: new Date("2026-09-30T18:02:00Z") }),
    ).toEqual([
      { at: new Date("2026-09-30T18:02:00Z"), status: "sent", details: {}, tag: copy.backends.airtable },
      { at: new Date("2026-09-30T18:00:00Z"), status: "created", label: copy.columns.created, details: {} },
    ]);
    // PauseAI's, from a mailing copied from Airtable, written and sent at once.
    const sent = { at: examplePauseaiLetterDetails.sentAt, status: "sent", details: {}, tag: copy.backends.airtable };
    expect(historyOf(examplePauseaiLetterDetails)).toEqual([sent]);
    // With something recorded later, it goes in its place, and when it was written isn't wanted.
    const bounce = { at: new Date("2026-10-02T09:00:00Z"), status: "bounced", details: {} };
    expect(
      historyOf({ ...examplePauseaiLetterDetails, createdAt: new Date("2026-09-01T09:00:00Z"), events: [bounce] }),
    ).toEqual([bounce, sent]);
    // PauseAI's never sent: nothing.
    expect(historyOf({ ...examplePauseaiLetterDetails, backend: null, sentAt: null })).toEqual([]);
  });

  it("shows the label and the tag in its line", async () => {
    await render(<LetterHistory events={historyOf({ ...airtable, createdAt: new Date("2026-10-12T08:00:00Z") })} />);
    const [sent, written] = page.getByRole("listitem").all();
    expect(sent.element().textContent).toContain(copy.status.sent);
    await expect.element(sent.getByText(copy.backends.airtable)).toBeVisible();
    expect(written.element().querySelector("strong")!.textContent).toBe(copy.columns.created);
  });
});
