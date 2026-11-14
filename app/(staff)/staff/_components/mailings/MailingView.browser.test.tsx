import { describe, expect, it, onTestFinished, vi } from "vitest";
import { render } from "vitest-browser-react";
import { chooseDay } from "@/tests/browser/date-picker";
import { page } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import type { Mailing } from "@/lib/mailings/records.server";
import MailingView from "./MailingView";
import { exampleWrittenMailing } from "./MailingWriter.examples";
import { exampleMailing, exampleMailings } from "./MailingsTable.examples";
import { asksCopy } from "@/lib/asks/copy";
import { exampleAsks } from "../asks/AsksList.examples";
import { mailingsCopy } from "./copy";
import { MailingStandingExample } from "./MailingView.gallery.client";
import { lettersCopy } from "../letters/copy";

const copy = mailingsCopy.mailingPages;
const states = lettersCopy.copyStates;
const noAction = async () => {};
/** Whether the page says `text`, whichever element it's in and however its line wraps. */
const says = (text: string) => expect.poll(() => document.body.textContent).toContain(text);

describe("MailingView", () => {
  const written = { ...exampleWrittenMailing, state: "sent" as const };
  const mailing: Mailing = {
    ...exampleMailing,
    ...exampleMailings[0],
    recipients: exampleMailing.recipients.map((r, i) =>
      i === 2 ? { ...r, status: "skipped", skipReason: "left-office" } : r,
    ),
  };
  const view = (props: Partial<Parameters<typeof MailingView>[0]>) =>
    render(
      <MailingView
        mailing={mailing}
        written={written}
        who={<p>who</p>}
        asks={exampleAsks}
        stop={noAction}
        reschedule={noAction}
        {...props}
      />,
    );
  const recipient = (name: string) => page.getByRole("row").filter({ hasText: name });

  it("once sent: its band, how many answered, the email, and its recipients", async () => {
    await view({});
    await expect.element(page.getByRole("heading", { level: 1 })).toMatchTextContent(mailing.title);
    // With an ask, the bar says it's sent, not a tag: the one Sent is the label of when it went.
    expect(page.getByText(copy.states.sent, { exact: true }).all()).toHaveLength(1);
    await expect.element(page.getByText(copy.answeredBar(3, 12))).toBeVisible();
    await expect.element(page.getByRole("progressbar", { name: states.tabs.answered })).toHaveAttribute("value", "3");
    // The band: when, by whom, from where and by what, the ask, and who it was for.
    await expect.element(page.getByText("20 Oct 2026", { exact: true })).toBeVisible();
    await expect.element(page.getByText(copy.by(written.createdBy))).toBeVisible();
    await expect.element(page.getByText("jo@pauseai.uk", { exact: true })).toBeVisible();
    await expect
      .element(page.getByText(`Jo Example · ${mailingsCopy.mailingPages.sendFacts.viaDetail("Gmail")}`))
      .toBeVisible();
    await expect.element(page.getByText("who")).toBeVisible();
    await expect.element(page.getByText(staffVocabulary.politicians(12))).toBeVisible();
    // The counts in two groups, each under its total: those that went, and those that didn't.
    await expect.element(page.getByRole("group", { name: `10 ${states.groups.went}` })).toBeVisible();
    await expect.element(page.getByRole("group", { name: `2 ${states.groups.gone}` })).toBeVisible();
    // Each count leads to those recipients, none chosen; a count of none isn't shown.
    await expect
      .element(page.getByRole("link", { name: `2 ${states.counts.unreached}` }))
      .toHaveAttribute("href", "/staff/mailings/4?tab=unreached");
    await expect
      .element(page.getByRole("link", { name: `5 ${states.counts.sent}` }))
      .toHaveAttribute("href", "/staff/mailings/4?tab=sent");
    expect(document.querySelectorAll("a[aria-current]")).toHaveLength(0);
    await expect.element(page.getByText(states.counts["not-sent"]!)).not.toBeInTheDocument();
    // Each recipient: their seat and party, their answer, one tag of how it went, and their letter.
    await expect.element(recipient("Polly")).toMatchTextContent("Cities of London and Westminster · Labour (Co-op)");
    await expect.element(recipient("Polly")).toMatchTextContent(staffVocabulary.statuses.going);
    await expect.element(recipient("Polly").getByText(states.tags.answered!, { exact: true })).toBeVisible();
    await expect.element(recipient("Polly").getByText(states.tags.sent!, { exact: true })).not.toBeInTheDocument();
    await expect
      .element(recipient("Polly").getByRole("link", { name: staffVocabulary.letterAndReplies(2) }))
      .toHaveAttribute("href", "/staff/mailings/4/letters/11");
    await expect.element(recipient("Morag")).toMatchTextContent(states.tags["unreached:bounced"]!);
    await expect.element(recipient("Morag").getByRole("link", { name: staffVocabulary.theLetter })).toBeInTheDocument();
    // One skipped says why, with no letter to go to.
    await expect.element(recipient("Dora")).toMatchTextContent(states.tags["not-sent:left-office"]!);
    await expect
      .element(recipient("Dora").getByRole("link", { name: staffVocabulary.theLetter }))
      .not.toBeInTheDocument();
    // The email as a mail app shows one: from, to and the subject, then the letter and its files.
    await expect.element(page.getByText("Jo Example <jo@pauseai.uk>")).toBeVisible();
    await expect.element(page.getByText(copy.toEach)).toBeVisible();
    await expect.element(page.getByText("Come to the example conference")).toBeVisible();
    await expect.element(page.getByRole("list", { name: copy.attachments })).toBeVisible();
    await expect.element(page.getByText(mailingsCopy.mailingEditor.fields.salutation)).toBeVisible();
  });

  it("with no ask: no bar, Sent as a tag, and no answers; a count chosen, with the way back", async () => {
    await view({
      mailing: {
        ...mailing,
        ask: null,
        askTitle: null,
        tab: "replied",
        recipients: [
          { ...mailing.recipients[0], answer: null, replies: 0 },
          { ...mailing.recipients[1], status: "spam_complaint" },
          { ...mailing.recipients[2], status: "uncertain", skipReason: null, sentAt: null },
        ],
      },
    });
    await expect.element(page.getByRole("progressbar")).not.toBeInTheDocument();
    // Sent as its tag, as well as the label of when it went.
    expect(page.getByText(copy.states.sent, { exact: true }).all()).toHaveLength(2);
    await expect.element(page.getByRole("heading", { name: states.tabs.replied })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: copy.showEveryone }))
      .toHaveAttribute("href", "/staff/mailings/4");
    // The count chosen, pressed again, shows everyone, as its tooltip says.
    const chosen = page.getByRole("link", { name: `2 ${states.counts.replied}` });
    await expect.element(chosen).toHaveAttribute("aria-current", "true");
    await expect.element(chosen).toHaveAttribute("href", "/staff/mailings/4");
    await expect.element(chosen).toHaveAttribute("title", copy.showEveryone);
    await expect.element(page.getByRole("link", { name: `5 ${states.counts.sent}` })).not.toHaveAttribute("title");
    // Replied, as Airtable recorded it, with no reply kept: still one.
    await expect.element(recipient("Polly")).toMatchTextContent(states.tags.replied!);
    await expect
      .element(recipient("Polly").getByRole("link", { name: staffVocabulary.letterAndReplies(1) }))
      .toBeVisible();
    await expect.element(recipient("Morag")).toMatchTextContent(states.tags.spam!);
    // One whose send was cut off, dated when the mailing last changed.
    await expect.element(recipient("Dora")).toMatchTextContent(states.tags["error:unfinished"]!);
    await expect.element(recipient("Dora")).toMatchTextContent("28 Oct 2026");
  });

  it("stopped, said so, with how many it never sent; sent at no time when nothing's gone", async () => {
    await view({
      mailing: {
        ...mailing,
        ask: null,
        askTitle: null,
        sentAt: null,
        states: { ...mailing.states, "not-sent": 3 },
        tab: "not-sent",
        page: 2,
        pages: 2,
      },
      written: { ...written, state: "cancelled" },
    });
    // Stopped as its tag, and the tab's heading.
    await expect.element(page.getByText(copy.states.cancelled, { exact: true })).toBeVisible();
    await expect.element(page.getByRole("heading", { name: states.tabs["not-sent"] })).toBeVisible();
    await expect.element(page.getByText(mailingsCopy.mailings.notSent)).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: `3 ${states.counts["not-sent"]}` }))
      .toHaveAttribute("href", "/staff/mailings/4");
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.previous }))
      .toHaveAttribute("href", "/staff/mailings/4?tab=not-sent");
  });

  it("scheduled: when it sends, Change the time in London's hours and minutes, and Stop; no counts yet", async () => {
    vi.useFakeTimers({ now: new Date("2026-10-29T12:00:00Z"), toFake: ["Date"] });
    onTestFinished(() => void vi.useRealTimers());
    const forms: FormData[] = [];
    const action = async (form: FormData) => void forms.push(form);
    await view({ written: { ...written, state: "scheduled" }, stop: action, reschedule: action });
    await expect.element(page.getByText(copy.sends("Tue 1 Dec at 09:03"))).toBeVisible();
    expect(page.getByText(copy.states.scheduled, { exact: true }).all()).toHaveLength(2);
    await expect.element(page.getByRole("link", { name: `5 ${states.counts.sent}` })).not.toBeInTheDocument();
    await page.getByRole("button", { name: copy.changeTime }).click();
    await expect.element(page.getByRole("button", { name: copy.day })).toMatchTextContent("Tue 1 Dec 2026");
    await page.getByRole("combobox", { name: copy.hour }).selectOptions("10");
    await page.getByRole("combobox", { name: copy.minutes }).selectOptions("33");
    await page.getByRole("button", { name: copy.saveTime }).click();
    await page.getByRole("button", { name: copy.unschedule }).click();
    await expect
      .poll(() => forms.map((form) => [...form.entries()]))
      .toEqual([
        [
          ["id", "12"],
          ["day", "2026-12-01"],
          ["hour", "10"],
          ["minute", "33"],
        ],
        [["id", "12"]],
      ]);
  });

  it("Change the time starts one due overnight, or on the hour, at the run it goes on", async () => {
    vi.useFakeTimers({ now: new Date("2026-12-01T08:58:00Z"), toFake: ["Date", "setInterval", "clearInterval"] });
    onTestFinished(() => void vi.useRealTimers());
    await view({
      written: { ...written, state: "scheduled", dueAt: new Date("2026-12-03T03:00:00Z") },
      reschedule: async () => {},
    });
    await page.getByRole("button", { name: copy.changeTime }).click();
    await expect.element(page.getByRole("combobox", { name: copy.hour })).toHaveValue("6");
    await expect.element(page.getByRole("combobox", { name: copy.minutes })).toHaveValue("3");
  });

  it("Change the time never offers a time too soon: it starts at the first it can go, and moves on as time passes", async () => {
    vi.useFakeTimers({ now: new Date("2026-12-01T08:58:00Z"), toFake: ["Date", "setInterval", "clearInterval"] });
    onTestFinished(() => void vi.useRealTimers());
    const forms: FormData[] = [];
    const action = async (form: FormData) => void forms.push(form);
    await view({ written: { ...written, state: "scheduled" }, reschedule: action });
    await page.getByRole("button", { name: copy.changeTime }).click();
    const day = page.getByRole("button", { name: copy.day });
    const hour = page.getByRole("combobox", { name: copy.hour });
    const minute = page.getByRole("combobox", { name: copy.minutes });
    const option = (name: string) => page.getByRole("option", { name, exact: true });
    // The hours the sending runs in: overnight ones aren't offered. The minutes are its runs.
    expect(hour.getByRole("option").all()[0].element().textContent).toBe("06");
    expect(
      minute
        .getByRole("option")
        .all()
        .map((one) => one.element().textContent),
    ).toEqual([":03", ":18", ":33", ":48"]);
    // It's due at 09:00, so it goes on the 09:03 run, five minutes from now: it can still go then, and the hours
    // before it can't be chosen.
    await expect.element(day).toMatchTextContent("Tue 1 Dec 2026");
    await expect.element(hour).toHaveValue("9");
    await expect.element(minute).toHaveValue("3");
    await expect.element(option("08")).toBeDisabled();
    await expect.element(option("09")).not.toBeDisabled();
    // At 09:00, the 09:03 run is too soon, so 09:18, and :03 can't be chosen.
    vi.advanceTimersByTime(2 * 60_000);
    await expect.element(minute).toHaveValue("18");
    await expect.element(option(":03")).toBeDisabled();
    // Another day, any time; back to today, one too soon moves on.
    await chooseDay(day, "2026-12-02");
    await hour.selectOptions("7");
    await minute.selectOptions("3");
    await expect.element(option(":03")).not.toBeDisabled();
    await chooseDay(day, "2026-12-01");
    await expect.element(hour).toHaveValue("9");
    await expect.element(minute).toHaveValue("18");
    await page.getByRole("button", { name: copy.saveTime }).click();
    await expect
      .poll(() => forms.map((form) => [...form.entries()]))
      .toEqual([
        [
          ["id", "12"],
          ["day", "2026-12-01"],
          ["hour", "9"],
          ["minute", "18"],
        ],
      ]);
  });

  it("by its address alone, for a sender with no name or a blank one", async () => {
    const { rerender } = await view({ written: { ...written, fromName: null, createdBy: "" } });
    await expect.element(page.getByText("jo@pauseai.uk", { exact: true }).first()).toBeVisible();
    await expect.element(page.getByText(copy.by(""))).not.toBeInTheDocument();
    await rerender(
      <MailingView
        mailing={mailing}
        written={{ ...written, fromName: "", state: "scheduled" }}
        asks={exampleAsks}
        stop={noAction}
        reschedule={noAction}
      />,
    );
    await expect.element(page.getByText(copy.scheduledLine(mailing.to, "jo@pauseai.uk"))).toBeVisible();
  });

  it("sending: how far it's got, when it started, and Stop sending", async () => {
    await view({ written: { ...written, state: "sending" } });
    await expect.element(page.getByText(copy.sendingBar(10, 12))).toBeVisible();
    await expect.element(page.getByText(copy.started)).toBeVisible();
    await expect.element(page.getByRole("progressbar", { name: copy.sentLabel })).toHaveAttribute("value", "12");
    await expect.element(page.getByRole("button", { name: copy.stopSending })).toBeVisible();
    await expect.element(page.getByText(copy.states.sending, { exact: true })).not.toBeInTheDocument();
  });
});

describe("MailingView, for a mailing imported from Airtable", () => {
  const mailings = mailingsCopy.mailings;
  const imported = (props: Partial<Mailing> = {}) =>
    render(<MailingView mailing={{ ...exampleMailing, ...props }} asks={[]} stop={noAction} reschedule={noAction} />);

  it("says who it's from isn't recorded for one the import of old letters made", async () => {
    await imported({ sentFrom: null, fromName: null, oldLetters: true });
    await expect.element(page.getByText(mailings.notRecorded).first()).toBeVisible();
  });

  it("says who it's from by name alone for one with a name and no address", async () => {
    await imported({ sentFrom: null, fromName: "Joseph", oldLetters: true });
    await expect.element(page.getByText("Joseph").first()).toBeVisible();
    expect(document.body.textContent).not.toContain(mailings.notRecorded);
  });

  it("is when it went, its counts, each recipient's outcome and how it was written, and that it has no text", async () => {
    await imported({ ask: null });
    await expect.element(page.getByRole("heading", { level: 1 })).toMatchTextContent(exampleMailing.title);
    await expect.element(page.getByText(mailings.imported).first()).toBeVisible();
    await expect.element(page.getByText("1 Oct 2026", { exact: true }).first()).toBeVisible();
    await expect.element(page.getByText(staffVocabulary.politicians(4))).toBeVisible();
    await expect.element(page.getByText(mailings.noText)).toBeVisible();
    await expect
      .element(page.getByRole("row").filter({ hasText: "Polly" }))
      .toMatchTextContent(lettersCopy.letters.personalised);
    await expect
      .element(page.getByRole("link", { name: "Morag Example" }))
      .toHaveAttribute("href", "/staff/politicians/8");
  });

  it("with an ask, its bar", async () => {
    await imported();
    await expect.element(page.getByText(copy.answeredBar(1, 4))).toBeVisible();
  });

  it("pages its recipients, a hundred at a time, saying how many there are", async () => {
    await imported({ recipientsTotal: 250, page: 2, pages: 3 });
    await expect.element(page.getByText(mailings.recipientsCount(250))).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: staffVocabulary.paging.next }))
      .toHaveAttribute("href", `/staff/mailings/${exampleMailing.id}?page=3`);
  });
});

describe("an imported mailing's text", () => {
  const doc = {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "field", attrs: { field: "own" } }] }],
  };
  const imported = (props: Partial<Mailing>) => (
    <MailingView mailing={{ ...exampleMailing, ...props }} asks={[]} stop={() => {}} reschedule={() => {}} />
  );

  it("shows its template, with its fields as chips, saying so if it's approximate", async () => {
    const { rerender } = await render(
      imported({
        importedText: doc,
        importedSubject: "The subject",
        sentFrom: "joseph@pauseai.info",
        askKind: null,
        ask: null,
      }),
    );
    await says("The subject");
    await says(mailingsCopy.mailings.importedFields.own);
    expect(document.body.textContent).not.toContain(lettersCopy.letterThread.approximate);
    await rerender(imported({ importedText: doc, sentFrom: null, importedTextApproximate: true, askKind: "letter" }));
    await says(lettersCopy.letterThread.approximate);
    await says(mailingsCopy.mailings.notRecorded);
    await says(asksCopy.asks.askTo.letter);
  });
});

describe("MailingView's examples in the gallery", () => {
  it("does nothing when an action is pressed", async () => {
    await render(<MailingStandingExample />);
    await page.getByRole("button", { name: mailingsCopy.mailingPages.stopSending }).click();
    await expect.element(page.getByRole("button", { name: mailingsCopy.mailingPages.stopSending })).toBeVisible();
  });
});
