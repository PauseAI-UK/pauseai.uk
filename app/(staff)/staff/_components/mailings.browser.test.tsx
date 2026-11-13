import { describe, expect, it, onTestFinished, vi } from "vitest";
import { render } from "vitest-browser-react";
import { chooseDay } from "@/tests/browser/date-picker";
import { page } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import type { Mailing } from "@/lib/server/mailings";
import { DeleteDraft, StopMailing } from "./MailingButtons";
import MailingFor from "./MailingFor";
import { MailingLetter } from "./MailingLetter";
import { FilterPills } from "./MailingParts";
import LetterView from "./LetterView";
import { examplePauseaiLetterDetails, exampleSupporterLetterDetails } from "./LettersTable.examples";
import { mailingGroups } from "@/lib/mailing-groups";
import MailingView from "./MailingView";
import MailingsOverview from "./MailingsOverview";
import {
  exampleMailingLetter,
  examplePickedGroup,
  examplePickedList,
  exampleWriterData,
  exampleWrittenMailing,
} from "./MailingWriter.examples";
import {
  exampleDraft,
  exampleMailing,
  exampleMailings,
  exampleScheduled,
  exampleSending,
} from "./MailingsTable.examples";
import { exampleAsks, examplePolitician } from "./PoliticianTable.examples";

const copy = staffCopy.mailingPages;
const states = staffCopy.copyStates;
const noAction = async () => {};

describe("MailingLetter", () => {
  it("shows fields as chips by their labels, or their IDs, and a part for only some in a box saying who", async () => {
    await render(
      <MailingLetter
        doc={exampleMailingLetter}
        fields={{ salutation: "Salutation" }}
        conditions={{ "frontier-ai-letter:signed": "signed the letter" }}
      />,
    );
    await expect.element(page.getByText("Salutation", { exact: true })).toBeVisible();
    await expect.element(page.getByText("constituency", { exact: true })).toBeVisible();
    await expect.element(page.getByText(staffCopy.mailingEditor.onlyForLabel("signed the letter"))).toBeVisible();
    await expect.element(page.getByText("Will you come to the example conference?")).toBeVisible();
    expect(page.getByRole("listitem").all()).toHaveLength(1);
  });

  it("shows links, a linked field, and quotes", async () => {
    const link = { type: "link" as const, attrs: { href: "https://pauseai.uk/join" } };
    await render(
      <MailingLetter
        doc={{
          type: "doc",
          content: [
            {
              type: "blockquote",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Join", marks: [link] },
                    { type: "field", attrs: { field: "name" }, marks: [link] },
                  ],
                },
              ],
            },
          ],
        }}
      />,
    );
    await expect.element(page.getByRole("link", { name: "Join" })).toHaveAttribute("href", "https://pauseai.uk/join");
    await expect.element(page.getByRole("link", { name: "name" })).toHaveAttribute("href", "https://pauseai.uk/join");
    expect(document.querySelector("blockquote p")!.textContent).toBe("Joinname");
  });

  it("names a part's condition by its ID with no labels", async () => {
    await render(<MailingLetter doc={exampleMailingLetter} />);
    await expect
      .element(page.getByText(staffCopy.mailingEditor.onlyForLabel("frontier-ai-letter:signed")))
      .toBeVisible();
  });
});

describe("FilterPills", () => {
  it("says the filter as the list's chips do, the house first", async () => {
    await render(<FilterPills data={exampleWriterData} />);
    const pills = page.getByRole("list", { name: copy.whoLabel });
    await expect.element(pills.getByText(staffCopy.houses.commons)).toBeVisible();
    await expect.element(pills.getByText("Example Letter to the PM", { exact: false })).toBeVisible();
    expect(pills.getByRole("listitem").all()).toHaveLength(3);
  });

  it("puts a search in its own pill", async () => {
    await render(
      <FilterPills data={{ ...exampleWriterData, filter: { list: "politicians", params: { q: "smith" } } }} />,
    );
    await expect.element(page.getByRole("listitem")).toHaveTextContent(copy.searchPill("smith"));
  });

  it("says everyone in office for a filter of nothing", async () => {
    await render(<FilterPills data={{ ...exampleWriterData, filter: { list: "politicians", params: {} } }} />);
    await expect.element(page.getByText(copy.everyone)).toBeVisible();
  });

  it("says those ticked from a filter as its group on the day, with those added and taken off", async () => {
    const { rerender } = await render(<FilterPills data={examplePickedGroup} />);
    const words = () =>
      page
        .getByRole("listitem")
        .all()
        .map((item) => item.element().textContent);
    expect(words()).toEqual([
      staffCopy.houses.commons,
      staffCopy.filters.notChip(staffCopy.fields.party, "Labour"),
      copy.pickedFrom("3 Nov 2026", 3),
      copy.pickedPlus("Morag Example"),
      copy.pickedExcept("Ned Noaddress"),
    ]);
    // A group of everyone, and one ticked whose name isn't known, by their ID.
    const from = { params: {}, at: "2026-11-03T10:00:00Z", found: [7] };
    await rerender(
      <FilterPills
        data={{ ...examplePickedGroup, filter: { list: "politicians", params: {}, picked: { ids: [7, 99], from } } }}
      />,
    );
    await expect.poll(words).toEqual([copy.everyone, copy.pickedFrom("3 Nov 2026", 1), copy.pickedPlus("#99")]);
  });

  it("says those ticked by name, alphabetically, past the first ten as a count; or that no one is", async () => {
    const { rerender } = await render(<FilterPills data={examplePickedList} />);
    const words = () =>
      page
        .getByRole("listitem")
        .all()
        .map((item) => item.element().textContent);
    expect(words()).toEqual(["Dora Dummy", "Jane Smith", "Morag Example", "Polly Placeholder"]);
    const ids = Array.from({ length: 12 }, (_, i) => 100 + i);
    const names = Object.fromEntries(ids.map((id) => [id, `Person ${id}`]));
    await rerender(
      <FilterPills
        data={{ ...examplePickedList, names, filter: { list: "politicians", params: {}, picked: { ids } } }}
      />,
    );
    await expect.poll(() => words().at(-1)).toBe(copy.pickedMore(2));
    expect(words()).toHaveLength(11);
    await rerender(
      <FilterPills data={{ ...examplePickedList, filter: { list: "politicians", params: {}, picked: { ids: [] } } }} />,
    );
    await expect.element(page.getByText(copy.pickedNone)).toBeVisible();
  });
});

describe("DeleteDraft and StopMailing", () => {
  it("delete when pressed twice, and stop at once, each the mailing named", async () => {
    const forms: FormData[] = [];
    const action = vi.fn(async (form: FormData) => void forms.push(form));
    await render(
      <>
        <DeleteDraft id={5} action={action} />
        <StopMailing id={6} label="Stop" action={action} />
      </>,
    );
    await page.getByRole("button", { name: copy.deleteDraft }).click();
    await expect.element(page.getByRole("button", { name: staffCopy.deleteIt })).toHaveFocus();
    await page.getByRole("button", { name: staffCopy.deleteIt }).click();
    await page.getByRole("button", { name: "Stop" }).click();
    await expect.poll(() => forms.map((form) => form.get("id"))).toEqual(["5", "6"]);
  });

  it("turns back if the second press doesn't come, or focus goes elsewhere", async () => {
    const action = vi.fn();
    await render(
      <>
        <DeleteDraft id={5} action={action} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await page.getByRole("button", { name: copy.deleteDraft }).click();
    await page.getByRole("button", { name: "Elsewhere" }).click();
    await expect.element(page.getByRole("button", { name: copy.deleteDraft })).toBeVisible();
    vi.useFakeTimers();
    try {
      await page.getByRole("button", { name: copy.deleteDraft }).click();
      await expect.element(page.getByRole("button", { name: staffCopy.deleteIt })).toBeVisible();
      await vi.advanceTimersByTimeAsync(5000);
    } finally {
      vi.useRealTimers();
    }
    await expect.element(page.getByRole("button", { name: copy.deleteDraft })).toBeVisible();
    expect(action).not.toHaveBeenCalled();
  });

  it("stays red and pending while it deletes, though the focus leaves it and the time runs out", async () => {
    let finish = () => {};
    const action = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    await render(
      <>
        <DeleteDraft id={5} action={action} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await page.getByRole("button", { name: copy.deleteDraft }).click();
    await page.getByRole("button", { name: staffCopy.deleteIt }).click();
    const pressed = page.getByRole("button", { name: staffCopy.deleteIt });
    await expect.element(pressed).toHaveAttribute("aria-busy", "true");
    await page.getByRole("button", { name: "Elsewhere" }).click();
    vi.useFakeTimers();
    try {
      await vi.advanceTimersByTimeAsync(5000);
    } finally {
      vi.useRealTimers();
    }
    await expect.element(pressed).toHaveAttribute("aria-busy", "true");
    finish();
    await expect.element(page.getByRole("button", { name: copy.deleteDraft })).toBeVisible();
  });
});

describe("MailingsOverview", () => {
  const now = "2026-10-30T12:00:00Z";
  const groups = mailingGroups(
    {
      drafts: [exampleDraft, { ...exampleDraft, id: 7, title: "" }],
      comingUp: [exampleScheduled, exampleSending],
      sent: [...exampleMailings, { ...exampleMailings[1], id: 9, sentAt: new Date("2025-07-09T10:00:00Z") }],
    },
    new Date(now),
  );
  const row = (title: string) => page.getByRole("listitem").filter({ hasText: title });

  it("says who it's from isn't recorded for one the import of old letters made", async () => {
    const mailing = { ...exampleMailings[0], imported: true, sentFrom: null, fromName: null, oldLetters: true };
    await render(
      <MailingsOverview
        groups={mailingGroups({ drafts: [], comingUp: [], sent: [mailing] }, new Date(now))}
        now={now}
      />,
    );
    await expect.element(page.getByText(staffCopy.mailings.notRecorded, { exact: false })).toBeVisible();
  });

  it("says who it's from by name alone for one with a name and no address", async () => {
    const mailing = { ...exampleMailings[0], imported: true, sentFrom: null, fromName: "Joseph", oldLetters: true };
    await render(
      <MailingsOverview
        groups={mailingGroups({ drafts: [], comingUp: [], sent: [mailing] }, new Date(now))}
        now={now}
      />,
    );
    await expect.element(page.getByText("Joseph", { exact: false })).toBeVisible();
    expect(document.body.textContent).not.toContain(staffCopy.mailings.notRecorded);
  });

  it("groups them: coming up, then by month, then by year, each row only what matters at its stage", async () => {
    await render(<MailingsOverview groups={groups} now={now} />);
    expect(
      page
        .getByRole("heading", { level: 2 })
        .all()
        .map((h) => h.element().textContent),
    ).toEqual([copy.comingUp, "October 2026", "2025"]);
    // Each says where it stands after a dot. A draft: when it was saved, and how many it's to; one untitled, said so.
    await expect.element(row("Meet us in Westminster").first()).toMatchTextContent(copy.savedAt("28 Oct 2026"));
    await expect.element(row("Meet us in Westminster").first()).toMatchTextContent(copy.standing.draft(412));
    await expect.element(page.getByRole("link", { name: copy.untitled })).toHaveAttribute("href", "/staff/mailings/7");
    // Scheduled: when it goes, and how many it's to, its dot blue.
    await expect.element(row("Edinburgh: one week to go")).toMatchTextContent("Fri 30 Oct, 09:03");
    await expect.element(row("Edinburgh: one week to go")).toMatchTextContent(copy.standing.scheduled(72));
    expect(row("Edinburgh: one week to go").element().querySelector("i[data-tone=blue]")).not.toBeNull();
    // Sent, to how many.
    await expect.element(row("AI safety conference")).toMatchTextContent(copy.standing.sent(12));
    // Sending: its bar, leading to it.
    await expect.element(page.getByRole("progressbar", { name: copy.sentLabel })).toHaveAttribute("value", "214");
    await expect.element(page.getByText(copy.sendingBar(209, 650))).toBeVisible();
    // Sent: what needs a look, opening it with that tab chosen, and the rest folded behind how many are fine; the
    // day without this year. One with no letters has no counts.
    await expect
      .element(row("AI safety conference").getByRole("link", { name: `2 ${states.counts.unreached}` }))
      .toHaveAttribute("href", "/staff/mailings/4?tab=unreached");
    await expect.element(row("AI safety conference")).toMatchTextContent(states.andFine(10));
    await expect.element(row("AI safety conference")).toMatchTextContent("20 Oct");
    await expect.element(row("AI safety conference")).not.toMatchTextContent("20 Oct 2026");
    await expect.element(row("Ben Lake").first()).not.toMatchTextContent(states.allFine(0));
    expect(row("Ben Lake").first().element().querySelector("a[href*='tab=']")).toBeNull();
    // Last year's, with its year.
    await expect.element(row("Ben Lake").last()).toMatchTextContent("9 Jul 2025");
    // Who it's from, or Airtable, and its ask, leading to who answered it.
    await expect
      .element(row("Nov 26"))
      .toMatchTextContent(`${staffCopy.mailings.imported} · ${staffCopy.asks.askTo.event}`);
    // And who wrote it, as most go from the policy inbox.
    await expect
      .element(row("AI safety conference"))
      .toMatchTextContent(`Jo Example <jo@pauseai.uk> · ${copy.by("jo@pauseai.uk")} · `);
    // With no name of its own, its address alone.
    await expect.element(row("Edinburgh: one week to go")).toMatchTextContent("jo@pauseai.uk");
    await expect.element(row("Edinburgh: one week to go")).not.toMatchTextContent("<jo@pauseai.uk>");
    await expect
      .element(row("Edinburgh: one week to go").getByRole("link", { name: "Edinburgh conference" }))
      .not.toBeInTheDocument();
    await expect
      .element(page.getByRole("link", { name: "Edinburgh conference" }).first())
      .toHaveAttribute("href", "/staff/asks/edinburgh-conference-2026");
    // Nothing on it changes a mailing: its only buttons unfold how many are fine.
    expect(page.getByRole("button").all().length).toBeGreaterThan(0);
    expect(
      page
        .getByRole("button")
        .all()
        .every((button) => button.element().hasAttribute("aria-expanded")),
    ).toBe(true);
  });

  it("an ask with no sender says only the ask", async () => {
    const lone = {
      ...exampleMailings[1],
      id: 10,
      ask: "frontier-ai-letter",
      askTitle: "Frontier AI letter",
      askKind: "letter",
    };
    await render(
      <MailingsOverview groups={mailingGroups({ drafts: [], comingUp: [], sent: [lone] }, new Date(now))} now={now} />,
    );
    await expect.element(row("Ben Lake")).toMatchTextContent(`${staffCopy.asks.askTo.letter} Frontier AI letter`);
    await expect.element(row("Ben Lake")).not.toMatchTextContent(" · ");
  });

  it("says who wrote one with no sender, before its ask", async () => {
    const lone = {
      ...exampleMailings[1],
      id: 11,
      createdBy: "sam@pauseai.uk",
      ask: "frontier-ai-letter",
      askKind: "letter",
    };
    await render(
      <MailingsOverview groups={mailingGroups({ drafts: [], comingUp: [], sent: [lone] }, new Date(now))} now={now} />,
    );
    await expect
      .element(row("Ben Lake"))
      .toMatchTextContent(`${copy.by("sam@pauseai.uk")} · ${staffCopy.asks.askTo.letter}`);
  });

  it("says when there are none", async () => {
    await render(<MailingsOverview groups={[]} now={now} />);
    await expect.element(page.getByText(staffCopy.mailings.none)).toBeVisible();
  });
});

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
      .element(page.getByText(`Jo Example · ${staffCopy.broadcastPages.sendFacts.viaDetail("Gmail")}`))
      .toBeVisible();
    await expect.element(page.getByText("who")).toBeVisible();
    await expect.element(page.getByText(staffCopy.campaigns.politicians(12))).toBeVisible();
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
    await expect.element(recipient("Polly")).toMatchTextContent(staffCopy.statuses.going);
    await expect.element(recipient("Polly").getByText(states.tags.answered!, { exact: true })).toBeVisible();
    await expect.element(recipient("Polly").getByText(states.tags.sent!, { exact: true })).not.toBeInTheDocument();
    await expect
      .element(recipient("Polly").getByRole("link", { name: copy.letterAndReplies(2) }))
      .toHaveAttribute("href", "/staff/mailings/4/letters/11");
    await expect.element(recipient("Morag")).toMatchTextContent(states.tags["unreached:bounced"]!);
    await expect.element(recipient("Morag").getByRole("link", { name: copy.theLetter })).toBeInTheDocument();
    // One skipped says why, with no letter to go to.
    await expect.element(recipient("Dora")).toMatchTextContent(states.tags["not-sent:left-office"]!);
    await expect.element(recipient("Dora").getByRole("link", { name: copy.theLetter })).not.toBeInTheDocument();
    // The email as a mail app shows one: from, to and the subject, then the letter and its files.
    await expect.element(page.getByText("Jo Example <jo@pauseai.uk>")).toBeVisible();
    await expect.element(page.getByText(copy.toEach)).toBeVisible();
    await expect.element(page.getByText("Come to the example conference")).toBeVisible();
    await expect.element(page.getByRole("list", { name: copy.attachments })).toBeVisible();
    await expect.element(page.getByText(staffCopy.mailingEditor.fields.salutation)).toBeVisible();
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
    await expect.element(recipient("Polly").getByRole("link", { name: copy.letterAndReplies(1) })).toBeVisible();
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
    await expect.element(page.getByText(staffCopy.mailings.notSent)).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: `3 ${states.counts["not-sent"]}` }))
      .toHaveAttribute("href", "/staff/mailings/4");
    await expect
      .element(page.getByRole("link", { name: staffCopy.paging.previous }))
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
  const mailings = staffCopy.mailings;
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
    await expect.element(page.getByText(staffCopy.campaigns.politicians(4))).toBeVisible();
    await expect.element(page.getByText(mailings.noText)).toBeVisible();
    await expect.element(page.getByRole("row").filter({ hasText: "Polly" })).toMatchTextContent(mailings.personalised);
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
      .element(page.getByRole("link", { name: staffCopy.paging.next }))
      .toHaveAttribute("href", `/staff/mailings/${exampleMailing.id}?page=3`);
  });
});

describe("LetterView", () => {
  const letter = { ...examplePauseaiLetterDetails, mailingAsk: exampleAsks[0]!.slug };
  const politician = { ...examplePolitician, airtableId: null };
  const view = (props: Partial<Parameters<typeof LetterView>[0]>) =>
    render(
      <LetterView letter={letter} politician={politician} asks={exampleAsks} setStatus={noAction} {...props}>
        <p>the thread</p>
      </LetterView>,
    );

  it("answered: green, in place of how it went, with the ask as the politician's page has it, beside the thread and history", async () => {
    await view({});
    await expect.element(page.getByText(states.tags.answered!, { exact: true })).toBeVisible();
    await expect.element(page.getByRole("group", { name: exampleAsks[0]!.title })).toBeVisible();
    await expect.element(page.getByText("the thread")).toBeVisible();
    await expect.element(page.getByRole("heading", { name: staffCopy.letters.detail.historyTitle })).toBeVisible();
    await expect.element(page.getByText(staffCopy.mailings.personalised, { exact: false })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: letter.mpName }))
      .toHaveAttribute("href", `/staff/politicians/${letter.politicianId}`);
  });

  it("not answered, with no ask: how it went, as a mailing's list says it", async () => {
    const { rerender } = await view({
      letter: { ...letter, mailingAsk: null, status: "bounced", personalised: false },
    });
    await expect.element(page.getByText(states.tags["unreached:bounced"]!, { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("heading", { name: staffCopy.mailings.fields.ask, exact: true }))
      .not.toBeInTheDocument();
    const shows = (one: Partial<typeof letter>) =>
      rerender(
        <LetterView
          letter={{ ...letter, ...one }}
          politician={{ ...politician, statuses: {} }}
          asks={exampleAsks}
          setStatus={noAction}
        >
          <p>the thread</p>
        </LetterView>,
      );
    await shows({ status: "spam_complaint" });
    await expect.element(page.getByText(states.tags.spam!, { exact: true })).toBeVisible();
    // Gmail refused it, as it sends a mailing's letters; one copied from Airtable, not said what refused it.
    await shows({ status: "not_sent", backend: null });
    await expect.element(page.getByText(states.tags["error:gmail"]!, { exact: true })).toBeVisible();
    await shows({ status: "not_sent", backend: "airtable" });
    await expect.element(page.getByText(states.tags.error!, { exact: true })).toBeVisible();
    // Skipped, with why, though replied to.
    await shows({ status: "skipped", skipReason: "no-email", repliedAt: new Date("2026-10-02T09:00:00Z") });
    await expect.element(page.getByText(states.tags["not-sent:no-email"]!, { exact: true })).toBeVisible();
  });

  it("a supporter's: its campaign over its ask, tagged when it's to a test politician", async () => {
    const supporters = { ...exampleSupporterLetterDetails, campaignAsk: exampleAsks[0]!.slug };
    await view({ letter: supporters, politician: { ...politician, isTest: true } });
    await expect
      .element(page.getByRole("heading", { level: 1 }))
      .toHaveTextContent(staffCopy.letters.oneTitle(supporters.senderName, supporters.mpName));
    // It bounced, so says so, though the politician answered.
    await expect.element(page.getByText(states.tags["unreached:bounced"]!, { exact: true })).toBeVisible();
    await expect.element(page.getByText(staffCopy.politicians.flags.test, { exact: true })).toBeVisible();
    await expect.element(page.getByRole("heading", { name: staffCopy.mailings.fields.ask, exact: true })).toBeVisible();
    // Under the ask, the campaign it's based on.
    await expect.element(page.getByRole("group", { name: exampleAsks[0]!.title })).toBeVisible();
    const campaign = page.getByRole("link", { name: supporters.campaignTitle }).last();
    await expect.element(campaign).toBeVisible();
    const basedOn = campaign.element().closest("p")!;
    expect(basedOn.textContent).toBe(`${staffCopy.letters.detail.basedOn} ${supporters.campaignTitle}`);
    expect(
      page.getByRole("group").element().compareDocumentPosition(basedOn) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain(staffCopy.mailings.personalised);
  });

  it("a supporter's whose campaign makes no ask: the card is the campaign alone", async () => {
    await view({ letter: exampleSupporterLetterDetails });
    await expect
      .element(page.getByRole("heading", { name: staffCopy.letters.columns.campaign, exact: true }))
      .toBeVisible();
    await expect
      .element(page.getByRole("link", { name: exampleSupporterLetterDetails.campaignTitle }).last())
      .toBeVisible();
    expect(page.getByRole("group").all()).toHaveLength(0);
    await expect.element(page.getByText(staffCopy.letters.status.bounced, { exact: true }).first()).toBeVisible();
    expect(page.getByText(staffCopy.politicians.flags.test, { exact: true }).all()).toHaveLength(0);
  });
});

describe("MailingFor", () => {
  const actions = {
    start: vi.fn(),
    save: vi.fn(),
    attach: vi.fn(),
    detach: vi.fn(),
    sendTest: vi.fn(),
    schedule: vi.fn(),
    deleteDraft: noAction,
    stop: noAction,
    reschedule: noAction,
  };

  it("shows an imported mailing's recipients, a draft to write, or a mailing scheduled", async () => {
    const { rerender } = await render(
      <MailingFor data={{ kind: "imported", mailing: exampleMailing }} actions={actions} />,
    );
    await expect.element(page.getByText(staffCopy.mailings.noText)).toBeVisible();
    await rerender(
      <MailingFor data={{ kind: "draft", draft: exampleWrittenMailing, ...exampleWriterData }} actions={actions} />,
    );
    await expect.element(page.getByRole("textbox", { name: copy.letter })).toBeVisible();
    await rerender(
      <MailingFor
        data={{
          kind: "written",
          mailing: exampleMailing,
          written: { ...exampleWrittenMailing, state: "sent" },
          filter: exampleWriterData.filter,
          parties: [],
          asks: exampleAsks,
          names: {},
        }}
        actions={actions}
      />,
    );
    await expect.element(page.getByText(copy.answeredBar(1, 4))).toBeVisible();
  });
});
