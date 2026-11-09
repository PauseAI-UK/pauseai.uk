import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { GMAIL_DAILY_LIMIT } from "@/lib/gmail-connect";
import { staffCopy } from "@/lib/content/staff-interface";
import { mailingGroups } from "@/lib/mailing-groups";
import type { WhatsAppTemplate } from "@/lib/server/broadcast-drafts";
import { supportersSearch } from "@/lib/staff-search";
import { londonWhen, staffTime } from "@/lib/staff-time";
import { broadcastCost, textStopsAt } from "@/lib/broadcasts";
import { chooseDay } from "@/tests/browser/date-picker";
import { navigation } from "@/tests/browser/navigation";
import { EMPTY_MAILING_DOC } from "@/lib/mailing-doc";
import MessageCopyView from "./MessageCopyView";
import BroadcastFor, { BroadcastContact, BroadcastWho } from "./BroadcastFor";
import { ChoosingBroadcastFrame, BroadcastSupporters } from "./BroadcastSupporters";
import BroadcastView, { copyStatus } from "./BroadcastView";
import BroadcastWriter, { templateLine, type BroadcastWriterActions } from "./BroadcastWriter";
import ChannelWriter from "./ChannelWriter";
import {
  exampleMessageCopy,
  exampleBroadcastData,
  exampleBroadcastEmail,
  exampleBroadcastSent,
  exampleBroadcastSummary,
  exampleBroadcastText,
  exampleSupporterChoices,
  exampleTemplates,
  exampleTextWords,
  exampleWhatsAppWords,
} from "./BroadcastWriter.examples";
import BroadcastsOverview from "./BroadcastsOverview";
import SupporterBroadcasts from "./SupporterBroadcasts";
import TextBubble, { ChatBubble, LinkedText } from "./TextBubble";

const { leavePage } = vi.hoisted(() => ({ leavePage: vi.fn() }));
vi.mock("@/lib/leave-page", () => ({ leavePage }));
afterEach(() => leavePage.mockClear());

const copy = staffCopy.broadcastPages;
const WAIT = { timeout: 3000 };
const nothing = async () => {};
const stopsFor = (dueAt: Date) => copy.stopsOn(londonWhen(textStopsAt(dueAt), "short"));

function fakeActions() {
  let version = 4;
  const action = (answer: () => unknown) => vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => answer());
  return {
    save: action(() => ({ saved: true, version: ++version })),
    attach: action(() => ({ saved: true, version: ++version, attachments: [] })),
    detach: action(() => ({ saved: true, version: ++version, attachments: [] })),
    sendTest: action(() => ({ sent: true, id: "m", to: "me@pauseai.uk" })),
    schedule: action(() => ({ scheduled: true })),
    deleteDraft: vi.fn(async () => {}),
    changeConsent: action(() => true),
    create: vi.fn(async () => {}),
    submitTemplate: action(() => "submitted"),
    withdrawTemplate: action(() => true),
  };
}

async function renderWriter(props: Partial<Parameters<typeof BroadcastWriter>[0]> = {}) {
  const actions = fakeActions();
  await render(
    <BroadcastWriter
      data={exampleBroadcastData}
      draft={exampleBroadcastEmail}
      who={<p>Who</p>}
      actions={actions as unknown as BroadcastWriterActions}
      {...props}
    />,
  );
  return actions;
}

const button = (name: string | RegExp) => page.getByRole("button", { name });

describe("BroadcastWriter's Consent", () => {
  const topics = staffCopy.supporters.subscriptions.topics;
  const group = (name: string) => page.getByRole("radiogroup", { name });
  const radios = (name: string) =>
    [...group(name).element().querySelectorAll("button")].map((b) => [
      b.textContent,
      b.getAttribute("aria-checked") === "true",
      (b as HTMLButtonElement).disabled,
    ]);
  const choose = (within: string, name: string) => group(within).getByRole("radio", { name }).click();

  it("asks email or text, then offers that channel's Consents in a row, its own chosen, the other channel shut once it has words", async () => {
    await renderWriter();
    expect(radios(copy.consentChannel)).toEqual([
      [copy.channels.email, true, false],
      [copy.channels.text, false, true],
    ]);
    expect(radios(copy.facts.saidYes)).toEqual([
      [topics.email["site-forms"], true, false],
      [topics.email["luma-calendar"], false, false],
    ]);
  });

  it("offers either channel to one with no words of its own, showing the other's Consents without changing it", async () => {
    const actions = await renderWriter({ draft: { ...exampleBroadcastEmail, subject: "", body: EMPTY_MAILING_DOC } });
    await choose(copy.consentChannel, copy.channels.text);
    await vi.waitFor(
      () =>
        expect(radios(copy.facts.saidYes).map(([name]) => name)).toEqual([
          topics.phone["site-forms"],
          topics.phone["luma-calendar"],
          topics.phone.volunteering,
          topics.phone["march-day"],
        ]),
      WAIT,
    );
    expect(radios(copy.facts.saidYes).every(([, checked, disabled]) => !checked && !disabled)).toBe(true);
    expect(actions.changeConsent).not.toHaveBeenCalled();
  });

  it("saves what's typed, changes the Consent, and shows the draft as it is then", async () => {
    const actions = await renderWriter();
    const refreshes = navigation.refreshes;
    // The one it has already: nothing to change.
    await choose(copy.facts.saidYes, topics.email["site-forms"]);
    await choose(copy.facts.saidYes, topics.email["luma-calendar"]);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledWith(3, "email:luma-calendar:yes"), WAIT);
    expect(actions.changeConsent).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(navigation.refreshes).toBeGreaterThan(refreshes), WAIT);
    // Refused, nothing to show again.
    actions.changeConsent.mockResolvedValue(false);
    const before = navigation.refreshes;
    await choose(copy.facts.saidYes, topics.email["luma-calendar"]);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledTimes(2), WAIT);
    expect(navigation.refreshes).toBe(before);
  });

  it("on a draft, shows the other channel's form greyed till a Consent by it is chosen, which changes the draft", async () => {
    const actions = fakeActions();
    await render(
      <ChannelWriter
        data={exampleBroadcastData}
        draft={{ ...exampleBroadcastEmail, subject: "", body: EMPTY_MAILING_DOC }}
        who={<p>Who</p>}
        actions={actions as unknown as BroadcastWriterActions}
      />,
    );
    const subject = () => page.getByLabelText(copy.subject, { exact: true }).query();
    expect(subject()).not.toBeNull();
    expect(page.getByText(copy.problems["no-consent"]).query()).toBeNull();
    await choose(copy.consentChannel, copy.channels.text);
    await vi.waitFor(() => expect(subject()).toBeNull(), WAIT);
    await expect.element(page.getByText(copy.problems["no-consent"])).toBeVisible();
    expect(page.getByText("Who").element().closest("[inert]")).not.toBeNull();
    // To no one yet: the count waits for the Consent.
    expect(page.getByText(copy.willGet(412, "email")).query()).toBeNull();
    expect(page.getByText(copy.willGet(0, "text")).query()).toBeNull();
    // Back to its own channel: as it was.
    await choose(copy.consentChannel, copy.channels.email);
    await vi.waitFor(() => expect(subject()).not.toBeNull(), WAIT);
    expect(page.getByText(copy.problems["no-consent"]).query()).toBeNull();
    await choose(copy.consentChannel, copy.channels.text);
    await choose(copy.facts.saidYes, topics.phone["luma-calendar"]);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledWith(3, "phone:luma-calendar:yes"), WAIT);
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("on New broadcast, starts with neither channel chosen, everything after it greyed and still, and makes the draft", async () => {
    const actions = fakeActions();
    await render(
      <ChannelWriter
        fresh
        data={exampleBroadcastData}
        draft={{ ...exampleBroadcastEmail, subject: "", body: EMPTY_MAILING_DOC }}
        who={<p>Who</p>}
        actions={actions as unknown as BroadcastWriterActions}
      />,
    );
    expect(radios(copy.consentChannel).every(([, checked, disabled]) => !checked && !disabled)).toBe(true);
    expect(group(copy.facts.saidYes).query()).toBeNull();
    expect(page.getByText("Who").element().closest("[inert]")).not.toBeNull();
    expect(
      page
        .getByRole("button", { name: copy.schedule(0, "email") })
        .element()
        .closest("[inert]"),
    ).not.toBeNull();
    expect(group(copy.consentChannel).element().closest("[inert]")).toBeNull();
    // Nothing saved, so no save state.
    expect(page.getByText(staffCopy.mailingPages.savePill.saved).query()).toBeNull();
    // Text: its Consents, and the writer greyed below a text's, the choice kept.
    const subject = () => page.getByLabelText(copy.subject, { exact: true }).query();
    expect(subject()).not.toBeNull();
    await choose(copy.consentChannel, copy.channels.text);
    await vi.waitFor(() => expect(subject()).toBeNull(), WAIT);
    expect(radios(copy.consentChannel)[1]).toEqual([copy.channels.text, true, false]);
    await choose(copy.facts.saidYes, topics.phone["luma-calendar"]);
    await vi.waitFor(() => expect(actions.create).toHaveBeenCalledWith("phone:luma-calendar:yes"), WAIT);
    expect(actions.save).not.toHaveBeenCalled();
  });
});

describe("BroadcastWriter, by email", () => {
  it("shows the six sections, who's left out and why, what it'll cost, and schedules", async () => {
    const actions = await renderWriter();
    await expect.element(page.getByRole("heading", { name: exampleBroadcastEmail.subject, level: 1 })).toBeVisible();
    await expect.element(page.getByText(copy.willGet(412, "email"))).toBeVisible();
    await expect.element(page.getByText("Pat Example")).toBeInTheDocument();
    await expect.element(page.getByText(`1 ${copy.leftOutCounted.stopped}`, { exact: false })).toBeVisible();
    await expect.element(page.getByText(broadcastCost("email", 412).about, { exact: false })).toBeVisible();
    await button(copy.schedule(412, "email")).click();
    await vi.waitFor(() => expect(actions.schedule).toHaveBeenCalledWith(3, 4), WAIT);
    expect(navigation.refreshes).toBeGreaterThan(0);
  });

  it("keeps the button if scheduling is refused", async () => {
    const actions = fakeActions();
    actions.schedule.mockResolvedValue({ scheduled: false, reason: "conflict" });
    await render(
      <BroadcastWriter
        data={exampleBroadcastData}
        draft={exampleBroadcastEmail}
        who={null}
        actions={actions as unknown as BroadcastWriterActions}
      />,
    );
    await button(copy.schedule(412, "email")).click();
    await expect.element(button(copy.schedule(412, "email"))).toBeEnabled();
  });

  it("starts an empty email with a greeting, saved with its first change, and says what's missing", async () => {
    const actions = await renderWriter({
      draft: { ...exampleBroadcastEmail, subject: "", title: "", body: { type: "doc", content: [] }, dueAt: null },
    });
    await expect.element(page.getByRole("heading", { name: copy.newTitle.email, level: 1 })).toBeVisible();
    // Each under Schedule, and what a test needs under Send test too.
    await expect.element(page.getByText(copy.problems["no-subject"]).first()).toBeVisible();
    expect(page.getByText(copy.problems["no-subject"]).all()).toHaveLength(2);
    expect(page.getByText(copy.problems["no-letter"]).all()).toHaveLength(2);
    await expect.element(page.getByText(copy.problems["no-time"])).toBeVisible();
    await page.getByLabelText(copy.subject).fill("Events");
    await vi.waitFor(() => expect(actions.save).toHaveBeenCalled(), WAIT);
    const saved = actions.save.mock.calls[0][2] as { subject: string; body: { content: unknown[] } };
    expect(saved.subject).toBe("Events");
    // The greeting, a line to write on, and the signature a few lines down.
    expect(saved.body.content).toHaveLength(4 + copy.signature.length);
    await expect.element(page.getByRole("heading", { name: "Events", level: 1 })).toBeVisible();
  });

  it("goes to the list to change who, with the draft's filter and saved first", async () => {
    await renderWriter();
    await page.getByRole("link", { name: staffCopy.mailingPages.changeWho }).click();
    await vi.waitFor(() =>
      expect(leavePage).toHaveBeenCalledWith("/staff/supporters?contact=email%3Asite-forms%3Ayes&near=LS1&broadcast=3"),
    );
  });

  it("shows someone made up, any mix of fields and parts a press away, each field's fallback when they lack it", async () => {
    await renderWriter();
    const volunteers = button(copy.previewCases["volunteer:yes"]);
    const mp = button(copy.previewCases["has:mp"]);
    // Never a real supporter: the made-up one, with everything to start with.
    await expect.element(page.getByText("Jane Smith <jane.smith@example.com>")).toBeVisible();
    await expect.element(volunteers).toHaveAttribute("aria-pressed", "true");
    await volunteers.click();
    await expect.element(volunteers).toHaveAttribute("aria-pressed", "false");
    await mp.click();
    await expect.element(page.getByText(/your MP/).first()).toBeVisible();
    await mp.click();
    await expect.element(page.getByText(/Alex Example MP/).first()).toBeVisible();
  });

  it("sends a test copy, and says where it went, or that it couldn't", async () => {
    const actions = await renderWriter();
    await page.getByLabelText(copy.testTo).fill("me@pauseai.uk");
    await button(copy.sendTest).click();
    await expect.element(page.getByText(copy.testSent("me@pauseai.uk"))).toBeVisible();
    expect(actions.sendTest).toHaveBeenCalledWith(3, expect.any(Array), "me@pauseai.uk");
    actions.sendTest.mockResolvedValue({ sent: false, reason: "failed" });
    await button(copy.sendTest).click();
    await expect.element(page.getByText(copy.testFailed)).toBeVisible();
    await page.getByLabelText(copy.testTo).fill("no address");
    await expect.element(button(copy.sendTest)).toBeDisabled();
  });

  it("names what sends from each address, and changes to a connected Gmail", async () => {
    const actions = await renderWriter();
    // Each address names what sends from it.
    await expect
      .element(page.getByRole("option", { name: copy.fromOption("hello@pauseai.uk", "Postmark") }))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("option", { name: copy.fromOption("jo@pauseai.uk", "Gmail") }))
      .toBeInTheDocument();
    expect(document.body.textContent).not.toContain(GMAIL_DAILY_LIMIT.toLocaleString("en-GB"));
    await expect.element(page.getByText(copy.testVia.email("hello@pauseai.uk"))).toBeVisible();
    // An email's preview says nothing of how to stop; a text's does (below).
    await page.getByLabelText(copy.fromAccount, { exact: false }).selectOptions("jo@pauseai.uk");
    // The test goes the same way.
    await expect.element(page.getByText(copy.testVia.emailGmail("jo@pauseai.uk"))).toBeVisible();
    // How many it has sent today, of its daily limit; none for Postmark's.
    const sentToday = staffCopy.gmail.sentToday(12, GMAIL_DAILY_LIMIT.toLocaleString("en-GB"));
    await expect.element(page.getByText(sentToday)).toBeVisible();
    await page.getByLabelText(copy.fromName, { exact: false }).fill("Jo at PauseAI");
    await vi.waitFor(() => expect(actions.save).toHaveBeenCalled(), WAIT);
  });

  it("uses a connected Gmail's own name with none of its own, and won't go from one no longer connected", async () => {
    await renderWriter({ draft: { ...exampleBroadcastEmail, sentFrom: "jo@pauseai.uk", fromName: null } });
    await expect.element(page.getByText("Jo Example <jo@pauseai.uk>")).toBeVisible();
    await page.getByLabelText(copy.fromAccount, { exact: false }).selectOptions("hello@pauseai.uk");
  });

  it("says a Gmail isn't connected", async () => {
    await renderWriter({
      draft: { ...exampleBroadcastEmail, sentFrom: "gone@pauseai.uk", fromName: "" },
    });
    await expect.element(page.getByText(copy.problems["not-connected"])).toBeVisible();
  });

  it("says when no one's left to send to, and when the filter's values are gone", async () => {
    await renderWriter({
      data: { ...exampleBroadcastData, count: 0, leftOut: [], unknown: ["event=gone"] },
    });
    await expect.element(page.getByText(/event=gone/)).toBeVisible();
    await expect.element(page.getByText(copy.problems["no-recipients"])).toBeVisible();
  });

  it("says when nothing can be sent yet, and that someone saved it meanwhile", async () => {
    const actions = fakeActions();
    actions.save.mockResolvedValue({ saved: false, reason: "conflict" });
    await render(
      <BroadcastWriter
        data={{ ...exampleBroadcastData, sends: false }}
        draft={exampleBroadcastEmail}
        who={null}
        actions={actions as unknown as BroadcastWriterActions}
      />,
    );
    await expect.element(page.getByText(copy.cantSend)).toBeVisible();
    await expect.element(button(copy.schedule(412, "email"))).toBeDisabled();
    await page.getByLabelText(copy.subject).fill("Changed");
    await expect.element(page.getByText(staffCopy.mailingPages.saveStates.conflict)).toBeVisible();
  });

  it("saves what's written and the time chosen", async () => {
    const actions = await renderWriter();
    await page.getByRole("textbox", { name: copy.emailLabel }).click();
    await userEvent.keyboard("More words");
    await vi.waitFor(() => expect(JSON.stringify(actions.save.mock.calls.at(-1)?.[2])).toContain("More words"), WAIT);
    await page.getByLabelText(staffCopy.mailingPages.hour, { exact: false }).selectOptions("14");
    await vi.waitFor(() => expect(actions.save.mock.calls.at(-1)?.[2]).toHaveProperty("dueAt"), WAIT);
  });

  it("waits for an hour before it has a time", async () => {
    const actions = await renderWriter({ draft: { ...exampleBroadcastEmail, dueAt: null } });
    await expect.element(page.getByText(copy.problems["no-time"])).toBeVisible();
    const when = page.getByRole("region", { name: copy.sections.when });
    const soon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await chooseDay(when.getByRole("button", { name: staffCopy.mailingPages.day }), soon);
    await expect.element(page.getByText(copy.problems["no-time"])).toBeVisible();
    expect(actions.save).not.toHaveBeenCalled();
  });

  it("says nothing of a field no one lacks, and starts afresh from what isn't a broadcast's words", async () => {
    await renderWriter({
      draft: { ...exampleBroadcastEmail, body: { type: "nonsense" } as unknown as typeof exampleBroadcastEmail.body },
    });
    await expect.element(page.getByText(copy.problems["no-letter"]).last()).toBeVisible();
  });

  it("copes with a condition it has no words for, and a part for all but those", async () => {
    const body = {
      type: "doc" as const,
      content: [
        { type: "onlyFor" as const, attrs: { condition: "gone:yes" }, content: [{ type: "paragraph" as const }] },
      ],
    };
    await renderWriter({ draft: { ...exampleBroadcastEmail, body } });
    await expect.element(button("gone:yes")).toBeVisible();
  });
});

describe("BroadcastWriter, by text", () => {
  const onTemplate = {
    ...exampleBroadcastText,
    title: exampleTemplates[0].name,
    body: exampleTextWords,
    template: exampleTemplates[0],
  };

  const words = () => page.getByLabelText(copy.templateLabel, { exact: false }).first();
  const pick = (value: string) => words().selectOptions(value);

  it("starts with the templates to choose from, no preview, and greyed", async () => {
    await renderWriter({ draft: exampleBroadcastText });
    expect((words().element() as HTMLSelectElement).value).toBe("");
    await expect.element(page.getByText(copy.willGet(412, "text"))).toBeVisible();
    await expect.element(page.getByText(copy.chooseTemplate)).toBeVisible();
    await expect.element(page.getByText(copy.problems["no-template"])).toBeVisible();
    await expect.element(button(copy.schedule(412, "text"))).toBeDisabled();
    await expect.element(page.getByLabelText(copy.subject)).not.toBeInTheDocument();
    await expect.element(page.getByText("+44 7700 900000", { exact: true })).toBeVisible();
    // When it stops sending is said once it's scheduled, not here.
    expect(page.getByText(stopsFor(exampleBroadcastText.dueAt!)).query()).toBeNull();
  });

  it("offers only new words when there are no approved templates", async () => {
    await renderWriter({ draft: exampleBroadcastText, data: { ...exampleBroadcastData, templates: [] } });
    expect([...words().element().querySelectorAll("option")].map((o) => o.textContent)).toEqual([
      copy.pickTemplate,
      copy.newTemplate,
    ]);
    expect(words().element().querySelector("optgroup")).toBeNull();
  });

  it("chooses a template from the dropdown, naming it, its words only in the preview", async () => {
    const actions = await renderWriter({ draft: exampleBroadcastText });
    await pick("1");
    await expect
      .element(page.getByRole("heading", { name: "The march meets at 11:00 at Parliament Square.", level: 1 }))
      .toBeVisible();
    await expect.element(page.getByText(templateLine(exampleTemplates[0]))).toBeVisible();
    await vi.waitFor(() => expect(actions.save.mock.calls[0][2]).toMatchObject({ templateId: 1 }), WAIT);
    await pick("3");
    await expect.element(page.getByRole("heading", { name: "Our next event is on Saturday.", level: 1 })).toBeVisible();
  });

  it("opens the editor for new words, with no parts and WhatsApp's formatting, and keeps them and their name", async () => {
    await renderWriter({ draft: exampleBroadcastText });
    await pick("new");
    await expect.element(page.getByText(copy.newTemplateHint)).toBeVisible();
    await expect.element(page.getByText(staffCopy.mailingEditor.partsHeading)).not.toBeInTheDocument();
    await page.getByLabelText(copy.templateName).fill("March day");
    await page.getByRole("textbox", { name: copy.templateWords }).fill("See you at the march");
    // WhatsApp's formatting: bold, italic, lists and quotes, but no links, by button or by key.
    const editing = staffCopy.mailingEditor;
    await expect.element(button(editing.bold)).toBeVisible();
    await expect.element(button(editing.quote)).toBeVisible();
    expect(button(editing.link).query()).toBeNull();
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(page.getByRole("textbox", { name: editing.linkBar.address }).query()).toBeNull();
    // A template, then new words again: the words and their name are kept.
    await pick("1");
    await pick("new");
    await expect
      .element(page.getByRole("textbox", { name: copy.templateWords }))
      .toHaveTextContent("See you at the march");
    await expect.element(page.getByLabelText(copy.templateName)).toHaveValue("March day");
    await expect.element(page.getByRole("heading", { name: "March day", level: 1 })).toBeVisible();
  });

  it("opens on a draft's new words, titled by them, to send to WhatsApp before they can be scheduled", async () => {
    const actions = await renderWriter({
      draft: { ...exampleBroadcastText, title: "Hi there", body: exampleTextWords },
    });
    await expect.element(page.getByRole("heading", { name: "Hi there", level: 1 })).toBeVisible();
    await expect.element(button(copy.schedule(412, "text"))).toBeDisabled();
    await expect.element(page.getByText(copy.problems["not-approved"])).toBeVisible();
    await expect.element(page.getByText(copy.testVia.textNew)).toBeVisible();
    await expect.element(button(copy.sendTest)).toBeDisabled();
    const refreshes = navigation.refreshes;
    await button(copy.submitTemplate).click();
    await vi.waitFor(() => expect(actions.submitTemplate).toHaveBeenCalledWith(4), WAIT);
    await vi.waitFor(() => expect(navigation.refreshes).toBeGreaterThan(refreshes), WAIT);
    // Refused: nothing to show again.
    actions.submitTemplate.mockResolvedValue("already");
    const before = navigation.refreshes;
    await button(copy.submitTemplate).click();
    await vi.waitFor(() => expect(actions.submitTemplate).toHaveBeenCalledTimes(2), WAIT);
    expect(navigation.refreshes).toBe(before);
  });

  it("can't send words for approval before there are any, or while anything but the time stops it", async () => {
    await renderWriter({ draft: exampleBroadcastText });
    await page.getByLabelText(copy.templateLabel, { exact: false }).first().selectOptions("new");
    await expect.element(button(copy.submitTemplate)).toBeDisabled();
  });

  it("sends words for approval with no time chosen, but not with no number to send from, or nothing to send by", async () => {
    const draft = { ...exampleBroadcastText, title: "Hi there", body: exampleTextWords, dueAt: null };
    const { unmount } = await render(
      <BroadcastWriter
        data={exampleBroadcastData}
        draft={draft}
        who={<p>Who</p>}
        actions={fakeActions() as unknown as BroadcastWriterActions}
      />,
    );
    await expect.element(button(copy.submitTemplate)).toBeEnabled();
    await unmount();
    await renderWriter({ draft, data: { ...exampleBroadcastData, textNumber: null } });
    await expect.element(button(copy.submitTemplate)).toBeDisabled();
  });

  it("sends nothing for approval where nothing can send", async () => {
    await renderWriter({
      draft: { ...exampleBroadcastText, body: exampleTextWords },
      data: { ...exampleBroadcastData, sends: false },
    });
    await expect.element(button(copy.submitTemplate)).toBeDisabled();
  });

  it("shows words WhatsApp is reviewing as they were sent, unchangeable, and takes them back", async () => {
    const template = { ...exampleTemplates[0], status: "pending" as const, approvedAt: null, name: "Hi there" };
    const actions = await renderWriter({ draft: { ...exampleBroadcastText, body: exampleTextWords, template } });
    // Who asked, and when, under the dropdown, as an approved template's line is; then its name and words, as sent, each under its label.
    await expect.element(page.getByText(copy.templatePending("jo@pauseai.uk", "19 Oct 2026"))).toBeVisible();
    await expect.element(page.getByText(copy.templateName, { exact: true })).toBeVisible();
    await expect.element(page.getByText("Hi there", { exact: true })).toBeVisible();
    expect(page.getByRole("textbox", { name: copy.templateWords }).query()).toBeNull();
    expect(button(copy.submitTemplate).query()).toBeNull();
    await expect.element(page.getByText(copy.problems["not-approved"])).toBeVisible();
    const refreshes = navigation.refreshes;
    // Pressed once, it asks for a second press, and goes back if focus leaves it.
    await button(copy.withdrawTemplate).click();
    await expect.element(button(copy.withdrawSure)).toBeVisible();
    expect(actions.withdrawTemplate).not.toHaveBeenCalled();
    (button(copy.withdrawSure).element() as HTMLButtonElement).blur();
    await expect.element(button(copy.withdrawTemplate)).toBeVisible();
    // Or, left alone, after a few seconds.
    await button(copy.withdrawTemplate).click();
    await expect.element(button(copy.withdrawTemplate), { timeout: 6000 }).toBeVisible();
    await button(copy.withdrawTemplate).click();
    await button(copy.withdrawSure).click();
    await vi.waitFor(() => expect(actions.withdrawTemplate).toHaveBeenCalledWith(4), WAIT);
    await vi.waitFor(() => expect(navigation.refreshes).toBeGreaterThan(refreshes), WAIT);
    actions.withdrawTemplate.mockResolvedValue(false);
    const before = navigation.refreshes;
    await button(copy.withdrawTemplate).click();
    await button(copy.withdrawSure).click();
    await vi.waitFor(() => expect(actions.withdrawTemplate).toHaveBeenCalledTimes(2), WAIT);
    expect(navigation.refreshes).toBe(before);
  });

  it("titles a new text as new until it has words", async () => {
    await renderWriter({ draft: exampleBroadcastText });
    await expect.element(page.getByRole("heading", { name: copy.newTitle.text, level: 1 })).toBeVisible();
  });

  it("says why WhatsApp rejected the words", async () => {
    const template: WhatsAppTemplate = {
      ...exampleTemplates[0],
      status: "rejected",
      rejectedAt: new Date("2026-11-05T14:02:00Z"),
      rejectedReason: "It ends with a merge field.",
    };
    await renderWriter({ draft: { ...exampleBroadcastText, body: exampleTextWords, template } });
    await expect.element(page.getByText(/It ends with a merge field/)).toBeVisible();
  });

  it("previews a bubble, and sends a test to a number only on an approved template", async () => {
    const actions = await renderWriter({ draft: onTemplate });
    await expect.element(page.getByText(copy.stopButton, { exact: true })).toBeVisible();
    await expect.element(page.getByText(/Hi Jane, the march meets/)).toBeVisible();
    // The summary names the WhatsApp number it's from.
    await expect.element(page.getByText(/texts from PauseAI UK \(\+44 7700 900000\) on WhatsApp/)).toBeVisible();
    await expect.element(button(copy.sendTest)).toBeDisabled();
    await page.getByLabelText(copy.testTo).fill("+447700900002");
    await button(copy.sendTest).click();
    await vi.waitFor(() => expect(actions.sendTest).toHaveBeenCalledWith(4, expect.any(Array), "+447700900002"), WAIT);
  });

  it("says when a text can't be tested yet, and when there's no number", async () => {
    await renderWriter({
      draft: { ...onTemplate, dueAt: null },
      data: { ...exampleBroadcastData, sends: false, textNumber: null },
    });
    await expect.element(page.getByText(copy.testVia.textOff)).toBeVisible();
    await expect.element(page.getByText(copy.noNumber)).toBeVisible();
    await expect.element(page.getByText(/texts from PauseAI UK on WhatsApp/)).toBeVisible();
    // And it can't be scheduled till there's one.
    await expect.element(page.getByText(copy.problems["no-number"])).toBeVisible();
  });
});

describe("LinkedText", () => {
  it("makes each web address a link, as WhatsApp does, leaving a sentence's end out of it", async () => {
    await render(
      <p>
        <LinkedText text="Sign up at https://pauseai.uk/join. Or www.example.org, or not at all" />
      </p>,
    );
    await expect
      .element(page.getByRole("link", { name: "https://pauseai.uk/join" }))
      .toHaveAttribute("href", "https://pauseai.uk/join");
    await expect
      .element(page.getByRole("link", { name: "www.example.org" }))
      .toHaveAttribute("href", "https://www.example.org");
    await expect.element(page.getByText(/, or not at all$/)).toBeVisible();
  });
});

describe("TextBubble", () => {
  it("shows a text as WhatsApp does: bold, italic, a list, a quote, web addresses linked and a link's mark not", async () => {
    await render(<TextBubble from="PauseAI UK" words={exampleWhatsAppWords} time="07:18" />);
    const bubble = page.getByText("PauseAI UK").element().parentElement!;
    expect(bubble.querySelector("strong")?.textContent).toBe("11:00");
    expect(bubble.querySelector("strong em")?.textContent).toBe("Parliament Square");
    expect([...bubble.querySelectorAll("li")].map((li) => li.textContent)).toEqual(["Bring water", "Wear orange"]);
    expect(bubble.querySelector("blockquote")?.textContent).toBe("Pause AI now.");
    expect(bubble.querySelector("br")).not.toBeNull();
    expect([...bubble.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["https://pauseai.uk/march"]);
    expect(bubble.textContent).not.toMatch(/[>*_]/);
  });
});

describe("ChatBubble", () => {
  it("names ours, at the right, apart from theirs", async () => {
    await render(
      <>
        <ChatBubble who="Answer" when="now" ours>
          Yes
        </ChatBubble>
        <ChatBubble who="Theirs" when="now">
          Hi
        </ChatBubble>
      </>,
    );
    const colour = (who: string) => getComputedStyle(page.getByText(who).element()).color;
    expect(colour("Theirs")).not.toBe(colour("Answer"));
  });
});

describe("the supporters list", () => {
  const yes = supportersSearch({ contact: "email:site-forms:yes", near: "LS1" });
  const none = supportersSearch({ near: "LS1" });

  it("starts a broadcast to those found with a Consent filter answered yes, keeping who they are", async () => {
    await render(<BroadcastSupporters search={yes} total={430} action={nothing} />);
    await expect.element(button(copy.broadcastButton(430))).toBeVisible();
    expect(document.querySelector<HTMLInputElement>('input[name="contact"]')!.value).toBe("email:site-forms:yes");
    expect(document.querySelector<HTMLInputElement>('input[name="near"]')!.value).toBe("LS1");
  });

  it("isn't there without a Consent filter answered yes", async () => {
    await render(
      <div data-testid="here">
        <BroadcastSupporters search={none} total={1} action={nothing} />
      </div>,
    );
    await expect.element(page.getByTestId("here")).toBeEmptyDOMElement();
  });

  it("isn't there while choosing for a draft", async () => {
    const choosing = {
      id: 3,
      title: "Events",
      channel: "email" as const,
      topic: "site-forms" as const,
      blank: false,
    };
    await render(
      <div data-testid="here">
        <BroadcastSupporters search={yes} total={430} action={nothing} choosing={choosing} />
      </div>,
    );
    await expect.element(page.getByTestId("here")).toBeEmptyDOMElement();
  });

  describe("choosing who a draft goes to", () => {
    const choosing = {
      id: 3,
      title: "Events",
      channel: "email" as const,
      topic: "site-forms" as const,
      blank: false,
    };

    it("is only the page when it isn't", async () => {
      await render(
        <ChoosingBroadcastFrame search={yes} total={430} keep={nothing}>
          <p>The list</p>
        </ChoosingBroadcastFrame>,
      );
      await expect.element(page.getByText("The list")).toBeVisible();
      await expect.element(page.getByRole("region")).not.toBeInTheDocument();
    });

    it("names the draft, with Cancel, and keeps the filters from the bar", async () => {
      await render(
        <ChoosingBroadcastFrame choosing={choosing} search={yes} total={430} keep={nothing}>
          <p>The list</p>
        </ChoosingBroadcastFrame>,
      );
      await expect.element(page.getByText(copy.choosing("Events"))).toBeVisible();
      await expect.element(page.getByText(copy.choosingNew)).not.toBeInTheDocument();
      await expect
        .element(page.getByRole("link", { name: copy.choosingCancel }))
        .toHaveAttribute("href", "/staff/broadcasts/3");
      await expect.element(page.getByText(copy.choosingCount(430))).toBeVisible();
      await expect.element(button(copy.useThese(430))).toBeVisible();
    });

    it("says it's choosing for a new one, for a draft with nothing written yet", async () => {
      await render(
        <ChoosingBroadcastFrame choosing={{ ...choosing, blank: true }} search={yes} total={430} keep={nothing}>
          <p>The list</p>
        </ChoosingBroadcastFrame>,
      );
      await expect.element(page.getByText(copy.choosingNew)).toBeVisible();
      await expect.element(page.getByText(copy.choosing("Events"))).not.toBeInTheDocument();
    });
  });
});

describe("a broadcast's page", () => {
  const actions = { stop: nothing, reschedule: nothing };
  const who = <p>Who</p>;

  it("gives an email's counts, each leading to those recipients, its words and its recipients", async () => {
    await render(<BroadcastView data={exampleBroadcastSent} who={who} contact={null} {...actions} />);
    await expect.element(page.getByRole("heading", { name: exampleBroadcastSent.written.subject })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: `276 ${copy.counts.delivered}` }))
      .toHaveAttribute("href", "/staff/broadcasts/5?tab=delivered");
    await expect.element(page.getByRole("link", { name: copy.counts.read })).not.toBeInTheDocument();
    await expect.element(page.getByText(copy.emailTitle)).toBeVisible();
    await expect.element(page.getByText(staffCopy.campaigns.supporters(290), { exact: true })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "Jane Example" }))
      .toHaveAttribute("href", "/staff/supporters/7");
    await expect.element(page.getByText("Leeds")).toBeVisible();
    await expect.element(page.getByText(copy.erased)).toBeVisible();
    await expect.element(page.getByText(copy.skipReasons.blocked)).toBeVisible();
    await expect.element(page.getByText(copy.skipReasons.unsubscribed.email)).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: copy.threadLink }).first())
      .toHaveAttribute("href", "/staff/broadcasts/5/21");
    await expect.element(page.getByRole("link", { name: staffCopy.supporters.noName })).toBeVisible();
  });

  it("lists a tab, with its heading and the way back; pressing its count again shows everyone", async () => {
    await render(
      <BroadcastView
        data={{ ...exampleBroadcastSent, tab: "failed", pages: 2 }}
        who={who}
        contact={null}
        {...actions}
      />,
    );
    await expect.element(page.getByRole("heading", { name: copy.tabs.failed })).toBeVisible();
    await expect.element(page.getByRole("link", { name: staffCopy.mailingPages.showEveryone }).first()).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: new RegExp(copy.counts.failed) }))
      .toHaveAttribute("href", "/staff/broadcasts/5");
  });

  it("leads to a copy only once it has gone", async () => {
    const [one] = exampleBroadcastSent.recipients;
    const recipients = [
      { ...one, copyId: 31, status: "scheduled", read: false, sentAt: null },
      { ...one, copyId: 32, status: "cancelled", read: false, sentAt: null },
    ];
    await render(
      <BroadcastView data={{ ...exampleBroadcastSent, recipients }} who={who} contact={null} {...actions} />,
    );
    await expect.element(page.getByText(copy.statuses.scheduled)).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.threadLink })).not.toBeInTheDocument();
  });

  it("goes through the pages of everyone", async () => {
    await render(<BroadcastView data={{ ...exampleBroadcastSent, pages: 2 }} who={who} contact={null} {...actions} />);
    await expect
      .element(page.getByRole("link", { name: staffCopy.paging.next }))
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
    summary: { ...exampleBroadcastSummary, channel: "text" as const, read: 240 },
    written: {
      ...exampleBroadcastSent.written,
      channel: "text" as const,
      sentFrom: "+447700900000",
      body: exampleTextWords,
    },
  };

  it("gives a text's read count, and the text as a bubble, its fields as words", async () => {
    await render(<BroadcastView data={text} who={who} contact={null} {...actions} />);
    await expect.element(page.getByRole("link", { name: `240 ${copy.counts.read}` })).toBeVisible();
    await expect.element(page.getByText(copy.textTitle)).toBeVisible();
    await expect
      .element(page.getByText(`Hi {${copy.fieldWords.firstName}}, the march`, { exact: false }))
      .toBeVisible();
    await expect.element(page.getByText(copy.stopButton, { exact: true })).toBeVisible();
    await expect.element(page.getByText(copy.skipReasons.unsubscribed.text)).toBeVisible();
  });

  it("says one scheduled goes as it is, and when it stops, with no counts", async () => {
    const data = {
      ...text,
      summary: { ...text.summary, state: "scheduled" as const },
      written: { ...text.written, state: "scheduled" as const, dueAt: new Date("2026-11-07T07:18:00Z") },
    };
    await render(<BroadcastView data={data} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText(stopsFor(new Date("2026-11-07T07:18:00Z")))).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.counts.delivered })).not.toBeInTheDocument();
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
    await expect.element(button(staffCopy.mailingPages.stopSending)).toBeVisible();
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

  it("says each copy's status", () => {
    const base = { status: "delivered", skipReason: null, read: false };
    expect(copyStatus(base, "email").words).toBe(copy.statuses.delivered);
    expect(copyStatus({ ...base, read: true }, "text")).toEqual({ words: copy.statuses.read, tone: "green" });
    expect(copyStatus({ ...base, status: "failed" }, "text").tone).toBe("red");
    expect(copyStatus({ ...base, status: "skipped", skipReason: "not-on-whatsapp" }, "text").words).toBe(
      copy.skipReasons["not-on-whatsapp"],
    );
  });
});

describe("BroadcastFor", () => {
  const actions = {
    ...fakeActions(),
    stop: nothing,
    reschedule: nothing,
  } as unknown as Parameters<typeof BroadcastFor>[0]["actions"];

  it("shows a draft to write", async () => {
    await render(
      <BroadcastFor
        data={{ kind: "draft", draft: exampleBroadcastEmail, ...exampleBroadcastData }}
        actions={actions}
      />,
    );
    await expect.element(page.getByRole("heading", { name: copy.sections.write })).toBeVisible();
  });

  it("shows one sent", async () => {
    await render(<BroadcastFor data={exampleBroadcastSent} actions={actions} />);
    await expect.element(page.getByText(copy.recipientsTitle)).toBeVisible();
  });

  it("says what they said yes to apart, and the other filters as pills, or everyone who did", async () => {
    const supporters = staffCopy.supporters.subscriptions.topics;
    const view = await render(
      <>
        <BroadcastContact params={{ contact: "phone:luma-calendar:yes" }} />
        <BroadcastContact params={{ contact: "email:luma-calendar:yes" }} />
        <BroadcastWho params={{ contact: "email:site-forms:yes", near: "LS1" }} choices={exampleSupporterChoices} />
      </>,
    );
    await expect.element(page.getByText(supporters.phone["luma-calendar"])).toBeVisible();
    await expect.element(page.getByText(supporters.email["luma-calendar"])).toBeVisible();
    const pills = page.getByRole("list", { name: staffCopy.mailingPages.whoLabel }).getByRole("listitem");
    await expect.element(pills.first()).toBeVisible();
    expect(pills.all().map((pill) => pill.element().textContent)).toHaveLength(1);
    await view.unmount();
    await render(<BroadcastWho params={{ contact: "phone:luma-calendar:yes" }} choices={exampleSupporterChoices} />);
    await expect.element(page.getByText(copy.everyoneWhoSaidYes)).toBeVisible();
  });
});

describe("BroadcastsOverview", () => {
  const now = "2026-11-05T12:00:00Z";

  it("lists emails and texts, each with its channel, leading to its page", async () => {
    const waiting = {
      ...exampleBroadcastSummary,
      id: 4,
      state: "scheduled" as const,
      channel: "text" as const,
      title: "Waiting",
    };
    const plain = { ...exampleBroadcastSummary, id: 6, state: "scheduled" as const, title: "Plain" };
    const held = { ...exampleBroadcastSummary, id: 8, state: "draft" as const, title: "Held", waiting: true };
    await render(
      <BroadcastsOverview
        groups={mailingGroups(
          { drafts: [held], comingUp: [waiting, plain], sent: [{ ...exampleBroadcastSummary, title: "" }] },
          new Date(now),
        )}
        now={now}
      />,
    );
    await expect.element(page.getByRole("link", { name: "Waiting" })).toHaveAttribute("href", "/staff/broadcasts/4");
    await expect.element(page.getByText(copy.channels.text).first()).toBeVisible();
    // A draft whose words WhatsApp is reviewing says so beside its Draft.
    await expect.element(page.getByText(copy.waitingTag)).toBeVisible();
    await expect.element(page.getByText(staffCopy.mailingPages.states.scheduled).first()).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.untitled }).first()).toBeVisible();
    await expect.element(page.getByText(new RegExp(copy.counts.delivered)).first()).toBeVisible();
  });

  it("says when there are none", async () => {
    await render(<BroadcastsOverview groups={[]} now={now} />);
    await expect.element(page.getByText(copy.none)).toBeVisible();
  });
});

describe("MessageCopyView", () => {
  it("shows a text as they got it, and when it was delivered and read", async () => {
    await render(<MessageCopyView one={exampleMessageCopy} />);
    await expect.element(page.getByRole("heading", { name: "Jane Example" })).toBeVisible();
    await expect.element(page.getByText(copy.statuses.read, { exact: true }).first()).toBeVisible();
    await expect
      .element(page.getByLabelText(copy.threadTitle).getByText(staffTime(exampleMessageCopy.sentAt!)))
      .toBeVisible();
    await expect.element(page.getByText(copy.facts.read)).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.everythingElse("Jane Example") })).toBeVisible();
  });

  it("shows an email as the thread", async () => {
    const one = {
      ...exampleMessageCopy,
      channel: "email" as const,
      subject: "Thank you",
      sentFrom: "hello@pauseai.uk",
      address: "jane@example.com",
      readAt: null,
    };
    await render(<MessageCopyView one={one} />);
    await expect.element(page.getByRole("article", { name: "Thank you" })).toBeVisible();
    await expect.element(page.getByText(copy.standing.email("Jane Example"))).toBeVisible();
  });

  it("keeps only that one was sent, once they're erased", async () => {
    const one = {
      ...exampleMessageCopy,
      supporterId: null,
      name: null,
      address: null,
      merge: null,
      status: "skipped",
      skipReason: "blocked",
      sentAt: null,
      deliveredAt: null,
      readAt: null,
    };
    await render(<MessageCopyView one={one} />);
    await expect.element(page.getByRole("heading", { name: copy.erased })).toBeVisible();
    await expect.element(page.getByText(`Hi {${copy.fieldWords.firstName}}`, { exact: false })).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.everythingElse(copy.erased) })).not.toBeInTheDocument();
  });

  it("names someone with none", async () => {
    await render(<MessageCopyView one={{ ...exampleMessageCopy, name: null, channel: "email", address: null }} />);
    await expect.element(page.getByRole("heading", { name: staffCopy.supporters.noName })).toBeVisible();
  });
});

describe("SupporterBroadcasts", () => {
  it("lists those they were sent, leading to each", async () => {
    await render(
      <SupporterBroadcasts
        broadcasts={[
          {
            copyId: 21,
            messageId: 5,
            title: "March day",
            channel: "text",
            status: "delivered",
            skipReason: null,
            sentAt: new Date("2026-11-07T07:18:00Z"),
            read: true,
          },
          {
            copyId: 22,
            messageId: 6,
            title: "",
            channel: "email",
            status: "failed",
            skipReason: null,
            sentAt: null,
            read: false,
          },
          {
            copyId: 23,
            messageId: 7,
            title: "Stopped",
            channel: "email",
            status: "cancelled",
            skipReason: null,
            sentAt: null,
            read: false,
          },
        ]}
      />,
    );
    await expect.element(page.getByRole("link", { name: "March day" })).toHaveAttribute("href", "/staff/broadcasts/5");
    await expect
      .element(page.getByRole("link", { name: copy.threadLink }).first())
      .toHaveAttribute("href", "/staff/broadcasts/5/21");
    // One went to each of the two that went; the one stopped has no page of its own.
    await expect.poll(() => page.getByRole("link", { name: copy.threadLink }).elements().length).toBe(2);
    await expect.element(page.getByRole("link", { name: copy.untitled })).toBeVisible();
  });

  it("says when there are none", async () => {
    await render(<SupporterBroadcasts broadcasts={[]} />);
    await expect.element(page.getByText(copy.supporterNone)).toBeVisible();
  });
});
