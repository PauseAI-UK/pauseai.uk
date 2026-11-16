import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { londonWhen, staffTime } from "@/lib/staff-time";
import BroadcastView, { broadcastCounts } from "./BroadcastView";
import { CountGroups, NeedsAndFine } from "../mailings/CopyCounts";
import { CopyStatus, copyStatus } from "../letters/CopyStatus";
import { countsOpening } from "../ui/Counts";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import {
  exampleBroadcastEmail,
  exampleBroadcastSent,
  exampleBroadcastSummary,
  exampleTextWords,
} from "./BroadcastWriter.examples";
import { supportersCopy } from "../supporters/copy";
import { mailingsCopy } from "../mailings/copy";
import { lettersCopy } from "../letters/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { londonDate } from "@/lib/staff-time";
import { sendingStopsAt, waitStopsAt } from "@/lib/broadcasts/broadcasts";
import { BroadcastWaiting } from "./BroadcastView";
import { BroadcastViewExample } from "./BroadcastView.gallery.client";

const copy = broadcastsCopy.broadcastPages;
const stateWords = lettersCopy.copyStates;
const nothing = async () => {};

const button = (name: string | RegExp) => page.getByRole("button", { name });

describe("a broadcast's page", () => {
  const actions = { stop: nothing, reschedule: nothing, resume: nothing };
  const who = <p>Who</p>;

  it("gives an email's counts, each leading to those recipients, those sent first, its words and its recipients", async () => {
    await render(<BroadcastView data={exampleBroadcastSent} who={who} contact={null} {...actions} />);
    await expect.element(page.getByRole("heading", { name: exampleBroadcastSent.written.subject })).toBeVisible();
    // Those that went and nothing more is known: Gmail never says what arrived.
    await expect
      .element(
        page.getByRole("link", { name: `${exampleBroadcastSent.summary.states.sent} ${stateWords.counts.sent}` }),
      )
      .toHaveAttribute("href", "/staff/broadcasts/5?tab=sent");
    await expect.element(page.getByRole("link", { name: stateWords.counts.read })).not.toBeInTheDocument();
    await expect.element(page.getByText(copy.emailTitle)).toBeVisible();
    await expect.element(page.getByText(mailingsCopy.campaigns.supporters(290), { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "Jane Example" }))
      .toHaveAttribute("href", "/staff/supporters/7");
    await expect.element(page.getByText("Leeds")).toBeVisible();
    await expect.element(page.getByText(copy.erased)).toBeVisible();
    await expect.element(page.getByText(stateWords.tags["not-sent:blocked"]!)).toBeVisible();
    await expect.element(page.getByText(stateWords.tags["not-sent:unsubscribed"]!)).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: copy.threadLink }).first())
      .toHaveAttribute("href", "/staff/broadcasts/5/21");
    await expect.element(page.getByRole("link", { name: supportersCopy.supporters.noName })).toBeVisible();
  });

  it("lists a tab, with its heading and the way back; pressing its count again shows everyone", async () => {
    await render(
      <BroadcastView
        data={{ ...exampleBroadcastSent, tab: "error", pages: 2 }}
        who={who}
        contact={null}
        {...actions}
      />,
    );
    await expect.element(page.getByRole("heading", { name: stateWords.tabs.error })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: mailingsCopy.mailingPages.showEveryone }).first())
      .toBeVisible();
    await expect
      .element(page.getByRole("link", { name: new RegExp(stateWords.counts.error!) }))
      .toHaveAttribute("href", "/staff/broadcasts/5");
  });

  it("leads to a copy only once it has gone", async () => {
    const [one] = exampleBroadcastSent.recipients;
    const recipients = [
      { ...one, copyId: 31, status: "scheduled", state: "scheduled" as const, sentAt: null },
      { ...one, copyId: 32, status: "cancelled", state: "not-sent" as const, why: "cancelled", sentAt: null },
    ];
    await render(
      <BroadcastView data={{ ...exampleBroadcastSent, recipients }} who={who} contact={null} {...actions} />,
    );
    await expect.element(page.getByText(stateWords.tags.scheduled!)).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.threadLink })).not.toBeInTheDocument();
  });

  it("goes through the pages of everyone", async () => {
    await render(<BroadcastView data={{ ...exampleBroadcastSent, pages: 2 }} who={who} contact={null} {...actions} />);
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.next }))
      .toHaveAttribute("href", "/staff/broadcasts/5?page=2");
  });

  it("shows an email's files and who it's from without a name", async () => {
    const written = {
      ...exampleBroadcastSent.written,
      fromName: "",
      attachments: [{ id: 1, filename: "Brief.pdf", contentType: "application/pdf", size: 10 }],
    };
    await render(<BroadcastView data={{ ...exampleBroadcastSent, written }} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText("Brief.pdf")).toBeVisible();
  });

  const text = {
    ...exampleBroadcastSent,
    summary: {
      ...exampleBroadcastSummary,
      channel: "text" as const,
      states: { ...exampleBroadcastSummary.states, read: 240 },
    },
    written: {
      ...exampleBroadcastSent.written,
      channel: "text" as const,
      sentFrom: "+447700900000",
      body: exampleTextWords,
    },
  };

  it("gives a text's read count, and the text as a bubble, its fields as chips", async () => {
    await render(<BroadcastView data={text} who={who} contact={null} {...actions} />);
    await expect.element(page.getByRole("link", { name: `240 ${stateWords.counts.read}` })).toBeVisible();
    await expect.element(page.getByText(copy.textTitle)).toBeVisible();
    const words = page
      .getByText(/the march meets/)
      .element()
      .closest("p")!;
    expect(words.querySelector("[class*=field]")!.textContent).toBe(copy.fieldWords.firstName);
    await expect.element(page.getByText(TEMPLATE_FOOTER, { exact: true })).toBeVisible();
    await expect.element(page.getByText(stateWords.tags["not-sent:unsubscribed"]!)).toBeVisible();
  });

  it("says one scheduled goes as it is, with no counts", async () => {
    const data = {
      ...text,
      summary: { ...text.summary, state: "scheduled" as const },
      written: { ...text.written, state: "scheduled" as const, dueAt: new Date("2026-11-07T07:18:00Z") },
    };
    await render(<BroadcastView data={data} who={who} contact={null} {...actions} />);
    await expect
      .element(page.getByText(mailingsCopy.mailingPages.sends(londonWhen(new Date("2026-11-07T07:18:00Z"), "short"))))
      .toBeVisible();
    await expect.element(page.getByRole("link", { name: stateWords.counts.sent })).not.toBeInTheDocument();
    // Who the filters find now, as sending finds who it goes to.
    await expect.element(page.getByText(copy.recipientsNow)).toBeVisible();
    await expect.element(page.getByRole("table")).toBeVisible();
  });

  it("shows one sending with a bar, no tag, and untitled when it has none", async () => {
    const data = {
      ...exampleBroadcastSent,
      summary: { ...exampleBroadcastSummary, state: "sending" as const },
      written: { ...exampleBroadcastSent.written, state: "sending" as const, title: "" },
    };
    await render(<BroadcastView data={data} who={who} contact={null} {...actions} />);
    await expect.element(page.getByRole("heading", { name: copy.untitled })).toBeVisible();
    await expect.element(button(mailingsCopy.mailingPages.stopSending)).toBeVisible();
  });

  it("says who it's from when a name is empty, in a scheduled line", async () => {
    const data = {
      ...exampleBroadcastSent,
      summary: { ...exampleBroadcastSummary, state: "scheduled" as const },
      written: {
        ...exampleBroadcastSent.written,
        state: "scheduled" as const,
        fromName: "",
        dueAt: new Date("2026-11-07T07:18:00Z"),
      },
    };
    await render(<BroadcastView data={data} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText(copy.scheduledLine(290, "email", "hello@pauseai.uk"))).toBeVisible();
  });

  it("says one past its time that waits for CiviCRM is waiting to go, not when it sends", async () => {
    const due = new Date("2026-11-07T07:18:00Z");
    const data = {
      ...exampleBroadcastSent,
      summary: { ...exampleBroadcastSummary, state: "scheduled" as const },
      written: {
        ...exampleBroadcastSent.written,
        state: "scheduled" as const,
        dueAt: due,
        waitingSince: due,
        waitReason: "pull" as const,
      },
    };
    await render(<BroadcastView data={data} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText(copy.waitingDue)).toBeVisible();
    await expect
      .element(page.getByText(mailingsCopy.mailingPages.sends(londonWhen(due, "short"))))
      .not.toBeInTheDocument();
  });

  it("says the rest of one sending go tomorrow, once what sends it can send no more today", async () => {
    const data = {
      ...exampleBroadcastSent,
      atLimit: true,
      summary: { ...exampleBroadcastSummary, state: "sending" as const },
      written: { ...exampleBroadcastSent.written, state: "sending" as const },
    };
    await render(<BroadcastView data={data} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText(copy.moreTomorrow)).toBeVisible();
  });

  it("says why one stopped before it had all gone: CiviCRM, or a day's limit of emails", async () => {
    const stopped = (waitReason: "pull" | "limit") => ({
      ...exampleBroadcastSent,
      summary: { ...exampleBroadcastSummary, state: "cancelled" as const },
      written: {
        ...exampleBroadcastSent.written,
        state: "cancelled" as const,
        gaveUp: true,
        waitingSince: new Date("2026-11-07T07:18:00Z"),
        waitReason,
      },
    });
    const resume = vi.fn(async (form: FormData) => void form);
    await render(<BroadcastView data={stopped("limit")} who={who} contact={null} {...actions} resume={resume} />);
    await expect.element(page.getByText(copy.gaveUpLimit)).toBeVisible();
    // Resume sending sets it going again.
    await button(mailingsCopy.mailingPages.resume).click();
    await vi.waitFor(() => expect(resume).toHaveBeenCalled());
    expect(resume.mock.calls[0][0].get("id")).toBe(String(exampleBroadcastSent.written.id));
    await render(<BroadcastView data={stopped("pull")} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText(copy.gaveUp)).toBeVisible();
  });

  it("says each copy's state in one tag, in its colour, with why where there's one", async () => {
    expect(copyStatus({ state: "sent", why: null })).toEqual({ words: stateWords.tags.sent, tone: undefined });
    expect(copyStatus({ state: "delivered", why: null })).toEqual({ words: stateWords.tags.delivered, tone: "green" });
    expect(copyStatus({ state: "read", why: null }).tone).toBe("green");
    expect(copyStatus({ state: "look", why: null })).toEqual({ words: stateWords.tags.look, tone: "blue" });
    expect(copyStatus({ state: "opted-out", why: "whatsapp-reply" })).toEqual({
      words: stateWords.tags["opted-out:whatsapp-reply"],
      tone: "red",
    });
    // A why it has no words for: its state alone.
    expect(copyStatus({ state: "opted-out", why: "staff" }).words).toBe(stateWords.tags["opted-out"]);
    expect(copyStatus({ state: "error", why: "limit" })).toEqual({
      words: stateWords.tags["error:limit"],
      tone: "red",
    });
    expect(copyStatus({ state: "unreached", why: "bounced" })).toEqual({
      words: stateWords.tags["unreached:bounced"],
      tone: "amber",
    });
    // Not sent, as expected: plain.
    expect(copyStatus({ state: "not-sent", why: "no-permission" })).toEqual({
      words: stateWords.tags["not-sent:no-permission"],
      tone: undefined,
    });
    await render(<CopyStatus copyOf={{ state: "replied", why: null }} />);
    await expect.element(page.getByText(stateWords.tags.replied!, { exact: true })).toBeVisible();
  });
});

describe("BroadcastCounts", () => {
  const states = {
    sent: 3,
    delivered: 21,
    read: 25,
    replied: 3,
    look: 1,
    "opted-out": 2,
    error: 1,
    unreached: 2,
    "not-sent": 6,
  };
  const counts = (more: Partial<typeof states> = {}) =>
    countsOpening(
      "/staff/broadcasts/5",
      broadcastCounts({ ...exampleBroadcastSummary, channel: "text", states: { ...states, ...more } }),
    );

  it("gives each group a box, its total then its counts, leaving out any of none", async () => {
    const all = counts({ delivered: 0 });
    const { rerender } = await render(
      <CountGroups
        groups={[
          { key: "went", label: "went", counts: all.slice(0, 6) },
          { key: "gone", label: "didn't go", counts: all.slice(6) },
        ]}
      />,
    );
    await expect.element(page.getByText("34", { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: `25 ${stateWords.counts.read}` }))
      .toHaveAttribute("href", "/staff/broadcasts/5?tab=read");
    await expect
      .element(page.getByRole("link", { name: new RegExp(stateWords.counts.delivered) }))
      .not.toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: `6 ${stateWords.counts["not-sent"]}` })).toBeVisible();
    // A group of none: no line.
    await rerender(
      <CountGroups
        groups={[
          { key: "gone", label: "didn't go", counts: counts({ error: 0, unreached: 0, "not-sent": 0 }).slice(6) },
        ]}
      />,
    );
    await expect.element(page.getByText(/didn't go/)).not.toBeInTheDocument();
  });

  it("shows what needs a look, then unfolds the rest behind how many are fine; all fine when nothing needs one", async () => {
    const { rerender } = await render(<NeedsAndFine counts={counts()} />);
    await expect
      .element(page.getByRole("link", { name: `1 ${stateWords.counts.look}` }))
      .toHaveAttribute("href", "/staff/broadcasts/5?tab=look");
    await expect.element(page.getByRole("link", { name: `2 ${stateWords.counts.unreached}` })).toBeVisible();
    const fine = page.getByRole("button", { name: new RegExp(stateWords.andFine(58)) });
    await expect.element(page.getByRole("link", { name: `21 ${stateWords.counts.delivered}` })).not.toBeInTheDocument();
    await fine.click();
    await expect.element(fine).toHaveAttribute("aria-expanded", "true");
    await expect.element(page.getByRole("link", { name: `21 ${stateWords.counts.delivered}` })).toBeVisible();
    await fine.click();
    await expect.element(page.getByRole("link", { name: `21 ${stateWords.counts.delivered}` })).not.toBeInTheDocument();
    await rerender(<NeedsAndFine counts={counts({ look: 0, "opted-out": 0, error: 0, unreached: 0 })} />);
    await expect.element(page.getByRole("button", { name: new RegExp(stateWords.allFine(58)) })).toBeVisible();
    // Nothing at all: nothing to show.
    const none = {
      sent: 0,
      delivered: 0,
      read: 0,
      replied: 0,
      "not-sent": 0,
      look: 0,
      "opted-out": 0,
      error: 0,
      unreached: 0,
    };
    await rerender(<NeedsAndFine counts={counts(none)} />);
    await expect.element(page.getByRole("button")).not.toBeInTheDocument();
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
    // Begun later still, its seven days run out before its three of waiting do: it says the sooner.
    const later = new Date("2026-11-13T07:18:00Z");
    await rerender(
      <BroadcastWaiting
        written={{ ...exampleBroadcastEmail, state: "sending", dueAt: due, waitingSince: later, waitReason: "civicrm" }}
      />,
    );
    await expect.element(page.getByText(copy.waiting("civicrm", londonDate(sendingStopsAt(due))))).toBeVisible();
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

describe("BroadcastView's example in the gallery", () => {
  it("draws an email sent, a text sent and a text scheduled", async () => {
    await render(
      <>
        <BroadcastViewExample kind="email" />
        <BroadcastViewExample kind="text" />
        <BroadcastViewExample kind="scheduled" />
      </>,
    );
    await expect
      .element(page.getByText(mailingsCopy.mailingPages.states.scheduled, { exact: true }).first())
      .toBeVisible();
  });

  it("does nothing when a scheduled broadcast is unscheduled", async () => {
    await render(<BroadcastViewExample kind="scheduled" />);
    await page.getByRole("button", { name: mailingsCopy.mailingPages.unschedule }).click();
    await expect.element(page.getByRole("button", { name: mailingsCopy.mailingPages.unschedule })).toBeVisible();
  });
});
