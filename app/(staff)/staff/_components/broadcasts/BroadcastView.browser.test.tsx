import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import { londonWhen, staffDate, staffTime } from "@/lib/staff-time";
import { refused } from "@/lib/form-result";
import BroadcastView, { broadcastCounts, type BroadcastAction, type RetimeAction } from "./BroadcastView";
import { RefusalPlace } from "../ui/ResultForm";
import { CountGroups, NeedsAndFine } from "../mailings/CopyCounts";
import { CopyStatus, copyStatus } from "../letters/CopyStatus";
import { countsOpening } from "../ui/Counts";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import {
  exampleBroadcastEmail,
  exampleBroadcastSent,
  exampleBroadcastSummary,
  exampleBroadcastText,
  examplePlace,
  exampleTemplates,
  exampleVariant,
  onTemplate,
  exampleTextWords,
} from "./BroadcastWriter.examples";
import { staffMemberText } from "@/lib/staff-member";
import { supportersCopy } from "../supporters/copy";
import { mailingsCopy } from "../mailings/copy";
import { lettersCopy } from "../letters/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import type { SendingPause } from "@/lib/broadcasts/broadcasts";
import type { WrittenBroadcast } from "@/lib/broadcasts/drafts.server";
import { BroadcastWaiting, pauseInBrief } from "./BroadcastView";
import { BroadcastViewExample } from "./BroadcastView.gallery.client";

// The page's address, which the place a page says things at its top reads (RefusalPlace); and a router, for its links.
vi.mock("next/navigation", () => ({
  usePathname: () => "/staff/broadcasts/3",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({}),
}));

const copy = broadcastsCopy.broadcastPages;
const stateWords = lettersCopy.copyStates;
const nothing = async () => ({ ok: true as const });
/** An action that finds its broadcast gone, or moved on so there's nothing for it to do. */
const gone = async () => refused("gone");

const button = (name: string | RegExp) => page.getByRole("button", { name });

describe("a broadcast's page", () => {
  const actions = { stop: nothing, reschedule: nothing, resume: nothing };
  const who = <p>Who</p>;

  it("has Copy broadcast at its top right, which sends its ID", async () => {
    const copied: FormData[] = [];
    await render(
      <BroadcastView
        data={exampleBroadcastSent}
        who={who}
        contact={null}
        {...actions}
        copyIt={async (form) => {
          copied.push(form);
          return { ok: true };
        }}
      />,
    );
    await button(copy.copyBroadcast).click();
    await expect.poll(() => copied.map((form) => form.get("id"))).toEqual([String(exampleBroadcastSent.written.id)]);
  });

  it("says at the top of the page when a button finds its broadcast gone or moved on, and under the times when they've passed", async () => {
    const scheduled = {
      ...exampleBroadcastSent,
      summary: { ...exampleBroadcastSummary, state: "scheduled" as const },
      written: {
        ...exampleBroadcastSent.written,
        state: "scheduled" as const,
        dueAt: new Date("2099-01-07T07:18:00Z"),
        finishMinutes: 720,
      },
    };
    const reschedule = vi.fn<RetimeAction>(async () => refused("too-soon"));
    await render(
      <RefusalPlace>
        <BroadcastView
          data={scheduled}
          who={who}
          contact={null}
          stop={gone}
          reschedule={reschedule}
          resume={nothing}
          copyIt={gone}
        />
      </RefusalPlace>,
    );
    const alert = page.getByRole("alert");
    await button(copy.copyBroadcast).click();
    await expect.element(alert).toHaveTextContent(copy.refusals.copy.gone);
    await button(mailingsCopy.mailingPages.unschedule).click();
    await expect.element(alert).toHaveTextContent(copy.refusals.stop.gone);
    // Over the page, not by the button, which the page catching up takes away.
    expect(alert.element().closest("form")).toBeNull();
    await button(copy.changeTimes).click();
    await button(copy.saveTimes).click();
    await expect.element(alert).toHaveTextContent(copy.refusals.reschedule["too-soon"]);
    // In the form, under its fields, which keep the times chosen.
    expect(alert.element().closest("form")).toBe(button(copy.saveTimes).element().closest("form"));
    await expect.element(page.getByRole("combobox", { name: copy.keepsTryingFor })).toHaveValue("720");
    reschedule.mockResolvedValueOnce(refused("gone"));
    await button(copy.saveTimes).click();
    await expect.element(alert).toHaveTextContent(copy.refusals.reschedule.gone);
    expect(alert.element().closest("form")).toBeNull();
  });

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
    await expect.element(page.getByText(copy.facts.to(290), { exact: true })).toBeVisible();
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

  it("sorts its recipients by who or by when each last changed, keeping the tab, and pages keep the sort", async () => {
    const { rerender } = await render(
      <BroadcastView data={{ ...exampleBroadcastSent, tab: "error" }} who={who} contact={null} {...actions} />,
    );
    // When each last changed: under how it went on a phone, which has no room for its column.
    const when = staffTime(exampleBroadcastSent.recipients[0].changedAt!);
    await page.viewport(390, 800);
    await expect
      .element(page.getByRole("cell", { name: new RegExp(`${stateWords.tags.read}.*${when}`) }))
      .toBeVisible();
    // Hidden, so no longer a link anyone can reach.
    await expect.element(page.getByRole("link", { name: copy.columns.changed, exact: true })).not.toBeInTheDocument();
    await page.viewport(1280, 800);
    await expect.element(page.getByRole("cell", { name: when, exact: true })).toBeVisible();
    const heading = (name: string) => page.getByRole("link", { name, exact: true });
    await expect
      .element(heading(copy.columns.changed))
      .toHaveAttribute("href", "/staff/broadcasts/5?tab=error&sort=changed&dir=desc");
    await expect
      .element(heading(copy.columns.who))
      .toHaveAttribute("href", "/staff/broadcasts/5?tab=error&sort=who&dir=desc");
    await rerender(
      <BroadcastView
        data={{ ...exampleBroadcastSent, sort: { key: "changed", dir: "desc" }, pages: 2 }}
        who={who}
        contact={null}
        {...actions}
      />,
    );
    await expect.element(heading(copy.columns.changed)).toBeVisible();
    expect(heading(copy.columns.changed).element().closest("th")!.getAttribute("aria-sort")).toBe("descending");
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.next }))
      .toHaveAttribute("href", "/staff/broadcasts/5?sort=changed&dir=desc&page=2");
  });

  it("has nothing to sort one scheduled by", async () => {
    const written = { ...exampleBroadcastSent.written, state: "scheduled" as const };
    await page.viewport(1280, 800);
    await render(<BroadcastView data={{ ...exampleBroadcastSent, written }} who={who} contact={null} {...actions} />);
    await expect.element(page.getByRole("cell", { name: copy.columns.changed, exact: true })).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.columns.changed, exact: true })).not.toBeInTheDocument();
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

  it("shows a text as written, its map and buttons, and its second version above it, headed by its condition", async () => {
    const written = {
      ...text.written,
      header: "location" as const,
      place: examplePlace,
      buttons: [{ text: "I'm coming" }],
      textVersion: {
        condition: "wrote:regulate-ai",
        body: exampleTextWords,
        header: null,
        place: null,
        pictureId: null,
        buttons: [{ text: "Thanks" }],
        variant: exampleVariant(8, null, { status: "draft", approvedAt: null }),
      },
    };
    await render(<BroadcastView data={{ ...text, written }} who={who} contact={null} {...actions} />);
    const words = page.getByRole("region", { name: copy.textTitle });
    await expect.element(words.getByText(examplePlace.name, { exact: true })).toBeVisible();
    await expect.element(words.getByText("I'm coming")).toBeVisible();
    await expect.element(words.getByText("Thanks", { exact: true })).toBeVisible();
    await expect.element(words.getByText(copy.conditions.wrote("Regulate AI"), { exact: true }).first()).toBeVisible();
    await expect
      .element(words.getByRole("button", { name: copy.conditions.wrote("Regulate AI") }))
      .not.toBeInTheDocument();
  });

  it("says one scheduled goes as it is, with no counts", async () => {
    const data = {
      ...text,
      summary: { ...text.summary, state: "scheduled" as const },
      written: { ...text.written, state: "scheduled" as const, dueAt: new Date("2026-11-07T07:18:00Z") },
    };
    await render(<BroadcastView data={data} who={who} contact={null} {...actions} />);
    await expect
      .element(page.getByText(londonWhen(new Date("2026-11-07T07:18:00Z"), "short"), { exact: true }))
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

  it("counts those still to go apart, and says when one WhatsApp held is tried again", async () => {
    const heldTill = new Date("2026-10-19T10:00:00Z");
    const data = {
      ...exampleBroadcastSent,
      summary: {
        ...exampleBroadcastSummary,
        state: "sending" as const,
        states: { ...exampleBroadcastSummary.states, held: 1, "to-go": 2 },
      },
      written: { ...exampleBroadcastSent.written, state: "sending" as const },
      recipients: [
        {
          ...exampleBroadcastSent.recipients[0],
          status: "scheduled",
          sentAt: null,
          heldTill,
          state: "held" as const,
          why: "whatsapp-limit",
        },
      ],
    };
    await render(<BroadcastView data={data} who={who} contact={null} {...actions} />);
    await expect.element(page.getByRole("group", { name: `3 ${stateWords.groups.toGo}` })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: `1 ${stateWords.counts.held}` }))
      .toHaveAttribute("href", "/staff/broadcasts/5?tab=held");
    await expect.element(page.getByRole("link", { name: `2 ${stateWords.counts["to-go"]}` })).toBeVisible();
    // The went group leaves them out, and comes after.
    const groups = page.getByRole("group");
    await expect.element(groups.nth(0)).toHaveAccessibleName(`3 ${stateWords.groups.toGo}`);
    await expect.element(groups.nth(1)).toHaveAccessibleName(`276 ${stateWords.groups.went}`);
    await expect.element(page.getByText(stateWords.tags["held:whatsapp-limit"]!, { exact: true })).toBeVisible();
    // The sending's next run after then, in London.
    await expect.element(page.getByText(copy.heldTill("19 Oct 2026, 11:03"))).toBeVisible();
    // Not gone yet, so no way to its copy.
    await expect.element(page.getByRole("link", { name: copy.threadLink })).not.toBeInTheDocument();
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
    await expect.poll(() => document.body.textContent).toContain(copy.scheduledLine(290, "email", "hello@pauseai.uk"));
  });

  it("says when one scheduled or sending keeps trying until, and changes both times, or once sending, that alone", async () => {
    const dueAt = new Date("2099-01-07T07:18:00Z");
    const scheduled = {
      ...exampleBroadcastSent,
      summary: { ...exampleBroadcastSummary, state: "scheduled" as const },
      written: { ...exampleBroadcastSent.written, state: "scheduled" as const, dueAt, finishMinutes: 720 },
    };
    const changed: FormData[] = [];
    const reschedule = async (form: FormData) => {
      changed.push(form);
      return { ok: true as const };
    };
    const view = await render(
      <BroadcastView data={scheduled} who={who} contact={null} {...actions} reschedule={reschedule} />,
    );
    await expect.element(page.getByRole("term").filter({ hasText: copy.keepsTryingUntil })).toBeVisible();
    await expect
      .element(page.getByText(londonWhen(new Date("2099-01-07T19:18:00Z"), "short"), { exact: true }))
      .toBeVisible();
    await button(copy.changeTimes).click();
    await expect.element(page.getByRole("button", { name: mailingsCopy.mailingPages.day })).toBeVisible();
    await button(copy.saveTimes).click();
    await expect
      .poll(() => changed.map((form) => [form.get("day"), form.get("finish-minutes")]))
      .toEqual([["2099-01-07", "720"]]);
    // Sending, its time is past changing; when it keeps trying until isn't. The bubble open still, closed first.
    await userEvent.keyboard("{Escape}");
    const sending = {
      ...scheduled,
      summary: { ...scheduled.summary, state: "sending" as const },
      written: { ...scheduled.written, state: "sending" as const },
    };
    await view.rerender(<BroadcastView data={sending} who={who} contact={null} {...actions} />);
    // As Started beside it says its time.
    await expect.element(page.getByText(staffTime(new Date("2099-01-07T19:18:00Z")), { exact: true })).toBeVisible();
    await button(copy.changeTimes).click();
    await expect.element(page.getByRole("combobox", { name: copy.keepsTryingFor })).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: mailingsCopy.mailingPages.day, exact: true }))
      .not.toBeInTheDocument();
    // Sent, it tries no more.
    await view.rerender(<BroadcastView data={exampleBroadcastSent} who={who} contact={null} {...actions} />);
    await expect.element(page.getByRole("term").filter({ hasText: copy.keepsTryingUntil })).not.toBeInTheDocument();
  });

  it("says one past its time that waits for WhatsApp's approval is waiting for it, not when it sends", async () => {
    const due = new Date("2026-11-07T07:18:00Z");
    const pause: SendingPause = { kind: "waiting", reason: "approval", said: null, endsAt: due };
    const data = {
      ...exampleBroadcastSent,
      summary: { ...exampleBroadcastSummary, state: "scheduled" as const, pause },
      written: { ...exampleBroadcastSent.written, state: "scheduled" as const, dueAt: due },
    };
    await render(<BroadcastView data={data} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText(copy.standing.waiting)).toBeVisible();
  });

  it("says one past its time that waits for CiviCRM is waiting to go, not when it sends", async () => {
    const due = new Date("2026-11-07T07:18:00Z");
    const pause: SendingPause = { kind: "waiting", reason: "pull", said: null, endsAt: due };
    const data = {
      ...exampleBroadcastSent,
      summary: { ...exampleBroadcastSummary, state: "scheduled" as const, pause },
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
    // In place of how long till it sends.
    expect(document.body.textContent).not.toContain(mailingsCopy.mailingPages.sendsIn("").trim());
  });

  it("says the rest of one sending go tomorrow, once what sends it can send no more today, its bar grey and saying it's paused", async () => {
    const sending = {
      ...exampleBroadcastSent,
      summary: { ...exampleBroadcastSummary, state: "sending" as const },
      written: { ...exampleBroadcastSent.written, state: "sending" as const },
    };
    // Done: those sent and those that didn't go.
    const { to } = exampleBroadcastSummary;
    const sent = exampleBroadcastSummary.sent + exampleBroadcastSummary.failed;
    const bar = () => page.getByRole("progressbar", { name: mailingsCopy.mailingPages.sentLabel }).element();
    const view = await render(<BroadcastView data={sending} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText(mailingsCopy.mailingPages.sendingBar(sent, to))).toBeVisible();
    // The bar's tone is its class.
    const going = bar().className;
    const pause: SendingPause = { kind: "limit", channel: "email" };
    const paused = { ...sending, summary: { ...sending.summary, pause } };
    await view.rerender(<BroadcastView data={paused} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText(copy.moreTomorrow)).toBeVisible();
    await expect.element(page.getByText(copy.paused.bar(sent, to))).toBeVisible();
    expect(document.body.textContent).not.toContain(mailingsCopy.mailingPages.sendingBar(sent, to));
    expect(bar().className).not.toBe(going);
  });

  it("shows one all sent but for delayed emails as sending, waiting on them, with Give up in place of Stop sending", async () => {
    const stopsAt = new Date("2026-11-25T20:04:00Z");
    const pause: SendingPause = { kind: "delayed", delayed: 45, stopsAt };
    // Its state is sent; its summary says sending (withPause).
    const waiting = {
      ...exampleBroadcastSent,
      summary: { ...exampleBroadcastSummary, state: "sending" as const, pause },
    };
    const { sent, failed, to } = exampleBroadcastSummary;
    await render(<BroadcastView data={waiting} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText(copy.paused.bar(sent + failed, to))).toBeVisible();
    await expect.element(page.getByText(copy.delayedLeft(45, staffDate(stopsAt)))).toBeVisible();
    await expect.element(page.getByText(mailingsCopy.mailingPages.started)).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: mailingsCopy.mailingPages.stopSending }))
      .not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: copy.giveUp })).toBeVisible();
    // No tag saying it's sent.
    await expect
      .element(page.getByText(mailingsCopy.mailingPages.states.sent, { exact: true }))
      .not.toBeInTheDocument();
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
    const resume = vi.fn<BroadcastAction>(async () => ({ ok: true }));
    const view = await render(
      <RefusalPlace>
        <BroadcastView data={stopped("limit")} who={who} contact={null} {...actions} resume={resume} />
      </RefusalPlace>,
    );
    await expect.element(page.getByText(copy.gaveUpLimit)).toBeVisible();
    // Resume sending sets it going again.
    await button(mailingsCopy.mailingPages.resume).click();
    await vi.waitFor(() => expect(resume).toHaveBeenCalled());
    expect(resume.mock.calls[0][0].get("id")).toBe(String(exampleBroadcastSent.written.id));
    expect(page.getByRole("alert").query()).toBeNull();
    // One someone else set going first has the top of the page say so.
    resume.mockResolvedValueOnce(refused("gone"));
    await button(mailingsCopy.mailingPages.resume).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.refusals.resume.gone);
    await view.unmount();
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
    held: 0,
    "to-go": 0,
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
    // Those delayed haven't arrived, so they aren't fine: grey, but shown.
    await rerender(<NeedsAndFine counts={counts({ look: 0, "opted-out": 0, error: 0, unreached: 0, held: 5 })} />);
    await expect.element(page.getByRole("link", { name: `5 ${stateWords.counts.held}` })).toBeVisible();
    await expect.element(page.getByRole("button", { name: new RegExp(stateWords.andFine(58)) })).toBeVisible();
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
  const sending = { ...exampleBroadcastEmail, state: "sending" as const };

  it("says each pause in full, in an amber strip with a clock; nothing for one with none", async () => {
    const endsAt = new Date("2026-11-14T07:18:00Z");
    const until = new Date("2026-11-11T07:43:00Z");
    const stopsAt = new Date("2026-11-14T07:18:00Z");
    const pauses: [SendingPause, string][] = [
      [{ kind: "waiting", reason: "pull", said: null, endsAt }, copy.waiting("pull", staffDate(endsAt), null)],
      [
        { kind: "waiting", reason: "civicrm", said: "Down", endsAt },
        copy.waiting("civicrm", staffDate(endsAt), "Down"),
      ],
      // Till the sending's next run after `until`.
      [{ kind: "resting", until }, copy.resting("11 Nov 2026, 07:48")],
      [{ kind: "held", held: 20, until, stopsAt }, copy.heldLeft(20, "11 Nov 2026, 07:48", staffDate(stopsAt))],
      [{ kind: "limit", channel: "email" }, copy.moreTomorrow],
      [{ kind: "limit", channel: "text" }, copy.moreTomorrowText],
      [{ kind: "delayed", delayed: 45, stopsAt }, copy.delayedLeft(45, staffDate(stopsAt))],
      [{ kind: "delayed", delayed: 1, stopsAt }, copy.delayedLeft(1, staffDate(stopsAt))],
    ];
    const view = await render(<BroadcastWaiting written={sending} pause={null} />);
    expect(view.container.textContent).toBe("");
    for (const [pause, words] of pauses) {
      await view.rerender(<BroadcastWaiting written={sending} pause={pause} />);
      await expect.element(page.getByText(words)).toBeVisible();
    }
  });

  it("says that one stopped by itself, and why, whatever its pause was", async () => {
    const stopped = (waitReason: WrittenBroadcast["waitReason"]) => (
      <BroadcastWaiting
        written={{ ...exampleBroadcastEmail, state: "cancelled", gaveUp: true, waitReason }}
        pause={null}
      />
    );
    const { rerender } = await render(stopped("civicrm"));
    await expect.element(page.getByText(copy.gaveUp)).toBeVisible();
    // A text whose template WhatsApp paused; its seven days ran out, at a day's limit or while CiviCRM was down;
    // its copies kept failing.
    for (const [waitReason, words] of [
      ["template", copy.gaveUpTemplate],
      ["limit", copy.gaveUpLimit],
      ["late", copy.gaveUpLate],
      ["approval", copy.gaveUpApproval],
      ["failing", copy.gaveUpFailing],
    ] as const) {
      await rerender(stopped(waitReason));
      await expect.element(page.getByText(words)).toBeVisible();
    }
  });

  it("says, in blue, that one scheduled waits for WhatsApp to approve its template, before its time or after", async () => {
    const variant = exampleVariant(7, "Hi there", { status: "pending", approvedAt: null });
    const scheduled = (dueAt: Date) => (
      <BroadcastWaiting written={{ ...exampleBroadcastText, state: "scheduled", dueAt, variant }} pause={null} />
    );
    const by = staffMemberText(variant.createdBy!);
    const { rerender } = await render(scheduled(new Date("2099-01-01T09:18:00Z")));
    await expect.element(page.getByText(copy.approvalStrip(by, staffTime(variant.requestedAt), false))).toBeVisible();
    await rerender(scheduled(new Date("2020-01-01T09:18:00Z")));
    await expect.element(page.getByText(copy.approvalStrip(by, staffTime(variant.requestedAt), true))).toBeVisible();
  });

  it("says the same while WhatsApp reviews only its conditional variant, its default one approved", async () => {
    const sent = exampleVariant(7, "Hi there, for those who wrote", {
      status: "pending",
      approvedAt: null,
      createdBy: "sam@pauseai.uk",
    });
    const written = {
      ...onTemplate(exampleBroadcastText, exampleTemplates[0]),
      state: "scheduled" as const,
      dueAt: new Date("2099-01-01T09:18:00Z"),
      textVersion: {
        condition: "wrote:regulate-ai",
        body: exampleTextWords,
        header: null,
        place: null,
        pictureId: null,
        buttons: [],
        variant: sent,
      },
    };
    await render(<BroadcastWaiting written={written} pause={null} />);
    await expect
      .element(
        page.getByText(copy.approvalStrip(staffMemberText("sam@pauseai.uk"), staffTime(sent.requestedAt), false)),
      )
      .toBeVisible();
  });
});

describe("pauseInBrief", () => {
  it("is the word for a pause, and what it waits for or till when, as the sending's next run in London", () => {
    const word = copy.paused.word;
    const until = new Date("2026-11-19T10:07:00Z");
    expect(pauseInBrief({ kind: "waiting", reason: "pull", said: null, endsAt: until })).toEqual({
      word,
      till: copy.paused.forCiviCrm,
    });
    // The run after 10:07 is 10:18.
    expect(pauseInBrief({ kind: "resting", until })).toEqual({ word, till: copy.paused.till("10:18") });
    expect(pauseInBrief({ kind: "held", held: 2, until, stopsAt: until })).toEqual({
      word,
      till: copy.paused.till("Thu 19 Nov, 10:18"),
    });
    expect(pauseInBrief({ kind: "limit", channel: "text" })).toEqual({ word, till: copy.paused.tillTomorrow });
    expect(pauseInBrief({ kind: "delayed", delayed: 2, stopsAt: until })).toEqual({
      word,
      till: copy.paused.forDelayed,
    });
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
