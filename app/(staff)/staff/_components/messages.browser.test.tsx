import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { GMAIL_DAILY_LIMIT } from "@/lib/gmail-connect";
import { staffCopy } from "@/lib/content/staff-interface";
import { mailingGroups } from "@/lib/mailing-groups";
import type { MessageTemplate } from "@/lib/server/message-drafts";
import { supportersSearch } from "@/lib/staff-search";
import { londonWhen, staffDate, staffTime } from "@/lib/staff-time";
import { messageCost, textStopsAt } from "@/lib/supporter-messages";
import { chooseDay } from "@/tests/browser/date-picker";
import { navigation } from "@/tests/browser/navigation";
import { EMPTY_MAILING_DOC } from "@/lib/mailing-doc";
import MessageCopyView from "./MessageCopyView";
import MessageFor, { MessageContact, MessageWho } from "./MessageFor";
import { ChoosingMessageFrame, MessageSupporters } from "./MessageSupporters";
import MessageView, { copyStatus } from "./MessageView";
import MessageWriter, { type MessageWriterActions } from "./MessageWriter";
import ChannelWriter from "./ChannelWriter";
import {
  exampleMessageCopy,
  exampleMessageData,
  exampleMessageEmail,
  exampleMessageSent,
  exampleMessageSummary,
  exampleMessageText,
  exampleSupporterChoices,
  exampleTemplates,
  exampleTextWords,
  exampleWhatsAppWords,
} from "./MessageWriter.examples";
import MessagesOverview from "./MessagesOverview";
import SupporterMessages from "./SupporterMessages";
import TemplatePicker from "./TemplatePicker";
import TextBubble, { ChatBubble, LinkedText } from "./TextBubble";

const { leavePage } = vi.hoisted(() => ({ leavePage: vi.fn() }));
vi.mock("@/lib/leave-page", () => ({ leavePage }));
afterEach(() => leavePage.mockClear());

const copy = staffCopy.messagePages;
const WAIT = { timeout: 3000 };
const nothing = async () => {};
const stopsFor = (dueAt: string) => copy.stopsOn(londonWhen(textStopsAt(dueAt), "short"));

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

async function renderWriter(props: Partial<Parameters<typeof MessageWriter>[0]> = {}) {
  const actions = fakeActions();
  await render(
    <MessageWriter
      data={exampleMessageData}
      draft={exampleMessageEmail}
      who={<p>Who</p>}
      actions={actions as unknown as MessageWriterActions}
      {...props}
    />,
  );
  return actions;
}

const button = (name: string | RegExp) => page.getByRole("button", { name });

describe("MessageWriter's Consent", () => {
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
    const actions = await renderWriter({ draft: { ...exampleMessageEmail, subject: "", body: EMPTY_MAILING_DOC } });
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
        data={exampleMessageData}
        draft={{ ...exampleMessageEmail, subject: "", body: EMPTY_MAILING_DOC }}
        who={<p>Who</p>}
        actions={actions as unknown as MessageWriterActions}
      />,
    );
    const subject = () => page.getByLabelText(copy.subject, { exact: true }).query();
    expect(subject()).not.toBeNull();
    expect(page.getByText(copy.problems["no-consent"]).query()).toBeNull();
    await choose(copy.consentChannel, copy.channels.text);
    await vi.waitFor(() => expect(subject()).toBeNull(), WAIT);
    await expect.element(page.getByText(copy.problems["no-consent"])).toBeVisible();
    expect(page.getByText("Who").element().closest("[inert]")).not.toBeNull();
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
        data={exampleMessageData}
        draft={{ ...exampleMessageEmail, subject: "", body: EMPTY_MAILING_DOC }}
        who={<p>Who</p>}
        actions={actions as unknown as MessageWriterActions}
      />,
    );
    expect(radios(copy.consentChannel).every(([, checked, disabled]) => !checked && !disabled)).toBe(true);
    expect(group(copy.facts.saidYes).query()).toBeNull();
    expect(page.getByText("Who").element().closest("[inert]")).not.toBeNull();
    expect(
      page
        .getByRole("button", { name: copy.schedule(412, "email") })
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

describe("MessageWriter, by email", () => {
  it("shows the six sections, who's left out and why, what it'll cost, and schedules", async () => {
    const actions = await renderWriter();
    await expect.element(page.getByRole("heading", { name: exampleMessageEmail.subject, level: 1 })).toBeVisible();
    await expect.element(page.getByText(copy.willGet(412, "email"))).toBeVisible();
    await expect.element(page.getByText("Pat Example")).toBeInTheDocument();
    await expect.element(page.getByText(`1 ${copy.leftOutCounted.stopped}`, { exact: false })).toBeVisible();
    await expect.element(page.getByText(messageCost("email", 412).about, { exact: false })).toBeVisible();
    await button(copy.schedule(412, "email")).click();
    await vi.waitFor(() => expect(actions.schedule).toHaveBeenCalledWith(3, 4), WAIT);
    expect(navigation.refreshes).toBeGreaterThan(0);
  });

  it("keeps the button if scheduling is refused", async () => {
    const actions = fakeActions();
    actions.schedule.mockResolvedValue({ scheduled: false, reason: "conflict" });
    await render(
      <MessageWriter
        data={exampleMessageData}
        draft={exampleMessageEmail}
        who={null}
        actions={actions as unknown as MessageWriterActions}
      />,
    );
    await button(copy.schedule(412, "email")).click();
    await expect.element(button(copy.schedule(412, "email"))).toBeEnabled();
  });

  it("starts an empty email with a greeting, saved with its first change, and says what's missing", async () => {
    const actions = await renderWriter({
      draft: { ...exampleMessageEmail, subject: "", title: "", body: { type: "doc", content: [] }, dueAt: null },
    });
    await expect.element(page.getByRole("heading", { name: copy.newTitle.email, level: 1 })).toBeVisible();
    await expect.element(page.getByText(copy.problems["no-subject"])).toBeVisible();
    await expect.element(page.getByText(copy.problems["no-letter"])).toBeVisible();
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
      expect(leavePage).toHaveBeenCalledWith("/staff/supporters?contact=email%3Asite-forms%3Ayes&near=LS1&message=3"),
    );
  });

  it("presses a case for each field and part, finding someone like that, and saying when there's no one", async () => {
    await renderWriter();
    const local = button(copy.conditions.localGroup.label);
    const mp = button(copy.conditions.mp.label);
    await expect.element(page.getByText("Jane Example <jane@example.com>")).toBeVisible();
    await expect.element(local).toHaveAttribute("aria-pressed", "true");
    await local.click();
    await expect.element(page.getByText(copy.noOneMix)).toBeVisible();
    await mp.click();
    await button(copy.conditions.volunteer.label).click();
    await expect.element(page.getByText("Sam <sam@example.com>")).toBeVisible();
    await expect.element(page.getByText(/your MP/).first()).toBeVisible();
  });

  it("sends a test copy, and says where it went, or that it couldn't", async () => {
    const actions = await renderWriter();
    await page.getByLabelText(copy.testTo).fill("me@pauseai.uk");
    await button(copy.sendTest).click();
    await expect.element(page.getByText(copy.testSent("me@pauseai.uk"))).toBeVisible();
    expect(actions.sendTest).toHaveBeenCalledWith(3, 7, "me@pauseai.uk");
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
    await expect.element(page.getByText(copy.testVia.email)).toBeVisible();
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
    await renderWriter({ draft: { ...exampleMessageEmail, sentFrom: "jo@pauseai.uk", fromName: null } });
    await expect.element(page.getByText("Jo Example <jo@pauseai.uk>")).toBeVisible();
    await page.getByLabelText(copy.fromAccount, { exact: false }).selectOptions("hello@pauseai.uk");
  });

  it("says a Gmail isn't connected", async () => {
    await renderWriter({
      draft: { ...exampleMessageEmail, sentFrom: "gone@pauseai.uk", fromName: "" },
    });
    await expect.element(page.getByText(copy.problems["not-connected"])).toBeVisible();
  });

  it("says when no one's left to preview, and when the filter's values are gone", async () => {
    await renderWriter({
      data: { ...exampleMessageData, recipients: [], count: 0, leftOut: [], unknown: ["event=gone"] },
    });
    await expect.element(page.getByText(copy.noOne)).toBeVisible();
    await expect.element(page.getByText(/event=gone/)).toBeVisible();
    await expect.element(page.getByText(copy.problems["no-recipients"])).toBeVisible();
  });

  it("says when nothing can be sent yet, and that someone saved it meanwhile", async () => {
    const actions = fakeActions();
    actions.save.mockResolvedValue({ saved: false, reason: "conflict" });
    await render(
      <MessageWriter
        data={{ ...exampleMessageData, sends: false }}
        draft={exampleMessageEmail}
        who={null}
        actions={actions as unknown as MessageWriterActions}
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
    const actions = await renderWriter({ draft: { ...exampleMessageEmail, dueAt: null } });
    await expect.element(page.getByText(copy.problems["no-time"])).toBeVisible();
    const when = page.getByRole("region", { name: copy.sections.when });
    const soon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await chooseDay(when.getByRole("button", { name: staffCopy.mailingPages.day }), soon);
    await expect.element(page.getByText(copy.problems["no-time"])).toBeVisible();
    expect(actions.save).not.toHaveBeenCalled();
  });

  it("says nothing of a field no one lacks, and starts afresh from what isn't a message's words", async () => {
    await renderWriter({
      draft: { ...exampleMessageEmail, body: { type: "nonsense" } as unknown as typeof exampleMessageEmail.body },
    });
    await expect.element(page.getByText(copy.problems["no-letter"])).toBeVisible();
  });

  it("goes back to the first if the one shown is no longer among them", async () => {
    const actions = fakeActions();
    const writer = (recipients: typeof exampleMessageData.recipients) => (
      <MessageWriter
        data={{ ...exampleMessageData, recipients }}
        draft={exampleMessageEmail}
        who={null}
        actions={actions as unknown as MessageWriterActions}
      />
    );
    const view = await render(writer(exampleMessageData.recipients));
    await view.rerender(writer([exampleMessageData.recipients[1]]));
    await expect.element(page.getByText("Sam <sam@example.com>")).toBeVisible();
  });

  it("copes with a condition it has no words for, and a part for all but those", async () => {
    const body = {
      type: "doc" as const,
      content: [
        { type: "onlyFor" as const, attrs: { condition: "gone:yes" }, content: [{ type: "paragraph" as const }] },
      ],
    };
    await renderWriter({ draft: { ...exampleMessageEmail, body } });
    await expect.element(button("gone:yes")).toBeVisible();
  });
});

describe("MessageWriter, by text", () => {
  const onTemplate = {
    ...exampleMessageText,
    title: exampleTemplates[0].name,
    body: exampleTextWords,
    template: exampleTemplates[0],
  };

  it("starts with the templates, no preview, and greyed", async () => {
    await renderWriter({ draft: exampleMessageText });
    await expect.element(page.getByRole("group", { name: copy.templatesLabel })).toBeVisible();
    await expect.element(page.getByRole("tab", { name: copy.templatesLabel })).toHaveAttribute("aria-selected", "true");
    await expect.element(page.getByText(copy.willGet(412, "text"))).toBeVisible();
    await expect.element(page.getByText(copy.chooseTemplate)).toBeVisible();
    await expect.element(page.getByText(copy.problems["no-template"])).toBeVisible();
    await expect.element(button(copy.schedule(412, "text"))).toBeDisabled();
    await expect.element(page.getByLabelText(copy.subject)).not.toBeInTheDocument();
    await expect.element(page.getByText("+44 7700 900000", { exact: true })).toBeVisible();
    // When it stops sending is said once it's scheduled, not here.
    expect(page.getByText(stopsFor(exampleMessageText.dueAt!)).query()).toBeNull();
  });

  it("keeps the list with the template chosen checked, its words read-only under it, and chooses another", async () => {
    const actions = await renderWriter({ draft: exampleMessageText });
    const march = page.getByRole("radio", { name: /March day reminder/ });
    await march.click();
    await expect.element(march).toBeChecked();
    await expect.element(page.getByText(copy.templateFixed, { exact: false })).toBeVisible();
    await expect.element(page.getByRole("heading", { name: "March day reminder", level: 1 })).toBeVisible();
    await vi.waitFor(() => expect(actions.save.mock.calls[0][2]).toMatchObject({ templateId: 1 }), WAIT);
    await expect.element(page.getByRole("group", { name: copy.templatesLabel })).toBeVisible();
    await page.getByRole("radio", { name: /Event reminder/ }).click();
    await expect.element(page.getByRole("heading", { name: "Event reminder", level: 1 })).toBeVisible();
    await expect.element(march).not.toBeChecked();
  });

  it("opens the editor for new words on their tab, with no parts, says they need approval, and keeps them", async () => {
    await renderWriter({ draft: exampleMessageText });
    const newTab = page.getByRole("tab", { name: copy.newTemplate });
    const approvedTab = page.getByRole("tab", { name: copy.templatesLabel });
    await newTab.click();
    await expect.element(newTab).toHaveAttribute("aria-selected", "true");
    await expect.element(page.getByText(copy.newTemplateHint)).toBeVisible();
    await expect.element(page.getByText(staffCopy.mailingEditor.partsHeading)).not.toBeInTheDocument();
    const words = page.getByRole("textbox", { name: copy.newTemplate });
    await words.fill("See you at the march");
    // WhatsApp's formatting: bold, italic, lists and quotes, but no links, by button or by key.
    const editing = staffCopy.mailingEditor;
    await expect.element(button(editing.bold)).toBeVisible();
    await expect.element(button(editing.quote)).toBeVisible();
    expect(button(editing.link).query()).toBeNull();
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(page.getByRole("textbox", { name: editing.linkBar.address }).query()).toBeNull();
    // The tab already open does nothing; the other shows the templates; back again, the words are kept.
    await newTab.click();
    await approvedTab.click();
    await expect.element(page.getByRole("group", { name: copy.templatesLabel })).toBeVisible();
    await newTab.click();
    await expect
      .element(page.getByRole("textbox", { name: copy.newTemplate }))
      .toHaveTextContent("See you at the march");
  });

  it("opens on a draft's new words, titled by them, to send to WhatsApp before they can be scheduled", async () => {
    const actions = await renderWriter({ draft: { ...exampleMessageText, title: "Hi there", body: exampleTextWords } });
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

  it("can't send words for approval before there are any", async () => {
    await renderWriter({ draft: exampleMessageText });
    await page.getByRole("tab", { name: copy.newTemplate }).click();
    await expect.element(button(copy.submitTemplate)).toBeDisabled();
  });

  it("shows words WhatsApp is reviewing as they were sent, unchangeable, and takes them back", async () => {
    const template = { ...exampleTemplates[0], status: "pending" as const, approvedAt: null, name: "Hi there" };
    const actions = await renderWriter({ draft: { ...exampleMessageText, body: exampleTextWords, template } });
    await expect.element(page.getByText(copy.templatePending)).toBeVisible();
    expect(page.getByRole("textbox", { name: copy.newTemplate }).query()).toBeNull();
    expect(button(copy.submitTemplate).query()).toBeNull();
    await expect.element(page.getByText(copy.problems["not-approved"])).toBeVisible();
    const refreshes = navigation.refreshes;
    await button(copy.withdrawTemplate).click();
    await vi.waitFor(() => expect(actions.withdrawTemplate).toHaveBeenCalledWith(4), WAIT);
    await vi.waitFor(() => expect(navigation.refreshes).toBeGreaterThan(refreshes), WAIT);
    actions.withdrawTemplate.mockResolvedValue(false);
    const before = navigation.refreshes;
    await button(copy.withdrawTemplate).click();
    await vi.waitFor(() => expect(actions.withdrawTemplate).toHaveBeenCalledTimes(2), WAIT);
    expect(navigation.refreshes).toBe(before);
  });

  it("titles a new text as new until it has words", async () => {
    await renderWriter({ draft: exampleMessageText });
    await expect.element(page.getByRole("heading", { name: copy.newTitle.text, level: 1 })).toBeVisible();
  });

  it("says why WhatsApp rejected the words", async () => {
    const template: MessageTemplate = {
      ...exampleTemplates[0],
      status: "rejected",
      rejectedAt: "2026-11-05T14:02:00Z",
      rejectedReason: "It ends with a merge field.",
    };
    await renderWriter({ draft: { ...exampleMessageText, body: exampleTextWords, template } });
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
    await vi.waitFor(() => expect(actions.sendTest).toHaveBeenCalledWith(4, 7, "+447700900002"), WAIT);
  });

  it("says when a text can't be tested yet, and when there's no number", async () => {
    await renderWriter({
      draft: { ...onTemplate, dueAt: null },
      data: { ...exampleMessageData, sends: false, textNumber: null },
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
  it("names a message as ours at the left, and an answer as ours at the right", async () => {
    await render(
      <>
        <ChatBubble who="Ours" when="now" fromUs>
          Hello
        </ChatBubble>
        <ChatBubble who="Answer" when="now" ours>
          Yes
        </ChatBubble>
        <ChatBubble who="Theirs" when="now">
          Hi
        </ChatBubble>
      </>,
    );
    const colour = (who: string) => getComputedStyle(page.getByText(who).element()).color;
    expect(colour("Ours")).toBe(colour("Answer"));
    expect(colour("Theirs")).not.toBe(colour("Ours"));
  });
});

describe("TemplatePicker", () => {
  const renderPicker = () => {
    const onChoose = vi.fn();
    return { onChoose, view: render(<TemplatePicker templates={exampleTemplates} onChoose={onChoose} />) };
  };

  it("shows five, then all; says who made each and when it was used", async () => {
    renderPicker();
    await expect.element(page.getByText("Write to your MP")).toBeVisible();
    await expect.element(page.getByText("Thank you for coming")).not.toBeInTheDocument();
    await expect.element(page.getByText(copy.templateMadeIn, { exact: false })).toBeVisible();
    await expect
      .element(page.getByText(copy.templateUsed(staffDate("2026-11-02T08:00:00Z"), 318), { exact: false }))
      .toBeVisible();
    await button(copy.showAll(6)).click();
    await expect.element(page.getByText("Thank you for coming")).toBeVisible();
    await expect.element(button(copy.showAll(6))).not.toBeInTheDocument();
  });

  it("searches names and words, however many there are, and says when none has them", async () => {
    renderPicker();
    const search = page.getByLabelText(copy.searchTemplates);
    await search.fill("thank");
    await expect.element(page.getByText("Thank you for coming")).toBeVisible();
    await expect.element(page.getByText("Event reminder")).not.toBeInTheDocument();
    await search.fill("parliament square");
    await expect.element(page.getByText("Event reminder")).toBeVisible();
    await search.fill("nothing like this");
    await expect.element(page.getByText(copy.noTemplates)).toBeVisible();
  });

  it("keeps the one chosen in the list, checked, though it's past the first five", async () => {
    await render(<TemplatePicker templates={exampleTemplates} chosen={exampleTemplates[5].id} onChoose={() => {}} />);
    await expect.element(page.getByRole("radio", { name: new RegExp(exampleTemplates[5].name) })).toBeChecked();
  });

  it("chooses one", async () => {
    const { onChoose } = renderPicker();
    await page.getByRole("radio", { name: /Event reminder/ }).click();
    expect(onChoose).toHaveBeenCalledWith(exampleTemplates[2]);
  });

  it("names one person's use in the singular", async () => {
    await render(<TemplatePicker templates={[{ ...exampleTemplates[0], lastUsedTo: 1 }]} onChoose={() => {}} />);
    await expect
      .element(page.getByText(copy.templateUsed(staffDate("2026-11-02T08:00:00Z"), 1), { exact: false }))
      .toBeVisible();
  });
});

describe("the supporters list", () => {
  const yes = supportersSearch({ contact: "email:site-forms:yes", near: "LS1" });
  const none = supportersSearch({ near: "LS1" });

  it("messages those found with a Consent filter answered yes, keeping who they are", async () => {
    await render(<MessageSupporters search={yes} total={430} action={nothing} />);
    await expect.element(button(copy.messageButton(430))).toBeVisible();
    expect(document.querySelector<HTMLInputElement>('input[name="contact"]')!.value).toBe("email:site-forms:yes");
    expect(document.querySelector<HTMLInputElement>('input[name="near"]')!.value).toBe("LS1");
  });

  it("isn't there without a Consent filter answered yes", async () => {
    await render(
      <div data-testid="here">
        <MessageSupporters search={none} total={1} action={nothing} />
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
        <MessageSupporters search={yes} total={430} action={nothing} choosing={choosing} />
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
        <ChoosingMessageFrame search={yes} total={430} keep={nothing}>
          <p>The list</p>
        </ChoosingMessageFrame>,
      );
      await expect.element(page.getByText("The list")).toBeVisible();
      await expect.element(page.getByRole("region")).not.toBeInTheDocument();
    });

    it("names the draft, with Cancel, and keeps the filters from the bar", async () => {
      await render(
        <ChoosingMessageFrame choosing={choosing} search={yes} total={430} keep={nothing}>
          <p>The list</p>
        </ChoosingMessageFrame>,
      );
      await expect.element(page.getByText(copy.choosing("Events"))).toBeVisible();
      await expect.element(page.getByText(copy.choosingNew)).not.toBeInTheDocument();
      await expect
        .element(page.getByRole("link", { name: copy.choosingCancel }))
        .toHaveAttribute("href", "/staff/messages/3");
      await expect.element(page.getByText(copy.choosingCount(430))).toBeVisible();
      await expect.element(button(copy.useThese(430))).toBeVisible();
    });

    it("says it's choosing for a new one, for a draft with nothing written yet", async () => {
      await render(
        <ChoosingMessageFrame choosing={{ ...choosing, blank: true }} search={yes} total={430} keep={nothing}>
          <p>The list</p>
        </ChoosingMessageFrame>,
      );
      await expect.element(page.getByText(copy.choosingNew)).toBeVisible();
      await expect.element(page.getByText(copy.choosing("Events"))).not.toBeInTheDocument();
    });
  });
});

describe("a message's page", () => {
  const actions = { stop: nothing, reschedule: nothing };
  const who = <p>Who</p>;

  it("gives an email's counts, each leading to those recipients, its words and its recipients", async () => {
    await render(<MessageView data={exampleMessageSent} who={who} contact={null} {...actions} />);
    await expect.element(page.getByRole("heading", { name: exampleMessageSent.written.subject })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: `276 ${copy.counts.delivered}` }))
      .toHaveAttribute("href", "/staff/messages/5?tab=delivered");
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
      .element(page.getByRole("link", { name: copy.messageAndReply }).first())
      .toHaveAttribute("href", "/staff/messages/5/21");
    await expect.element(page.getByRole("link", { name: staffCopy.supporters.noName })).toBeVisible();
  });

  it("lists a tab, with its heading and the way back; pressing its count again shows everyone", async () => {
    await render(
      <MessageView data={{ ...exampleMessageSent, tab: "failed", pages: 2 }} who={who} contact={null} {...actions} />,
    );
    await expect.element(page.getByRole("heading", { name: copy.tabs.failed })).toBeVisible();
    await expect.element(page.getByRole("link", { name: staffCopy.mailingPages.showEveryone }).first()).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: new RegExp(copy.counts.failed) }))
      .toHaveAttribute("href", "/staff/messages/5");
  });

  it("leads to a copy only once it has gone", async () => {
    const [one] = exampleMessageSent.recipients;
    const recipients = [
      { ...one, copyId: 31, status: "scheduled", read: false, sentAt: null },
      { ...one, copyId: 32, status: "cancelled", read: false, sentAt: null },
    ];
    await render(<MessageView data={{ ...exampleMessageSent, recipients }} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText(copy.statuses.scheduled)).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.messageAndReply })).not.toBeInTheDocument();
  });

  it("goes through the pages of everyone", async () => {
    await render(<MessageView data={{ ...exampleMessageSent, pages: 2 }} who={who} contact={null} {...actions} />);
    await expect
      .element(page.getByRole("link", { name: staffCopy.paging.next }))
      .toHaveAttribute("href", "/staff/messages/5?page=2");
  });

  it("shows an email's files and who it's from without a name", async () => {
    const written = {
      ...exampleMessageSent.written,
      fromName: "",
      attachments: [{ id: 1, filename: "Brief.pdf", contentType: "application/pdf", size: 10 }],
    };
    await render(<MessageView data={{ ...exampleMessageSent, written }} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText("Brief.pdf")).toBeVisible();
  });

  const text = {
    ...exampleMessageSent,
    summary: { ...exampleMessageSummary, channel: "text" as const, read: 240 },
    written: {
      ...exampleMessageSent.written,
      channel: "text" as const,
      sentFrom: "+447700900000",
      body: exampleTextWords,
    },
  };

  it("gives a text's read count, and the text as a bubble, its fields as words", async () => {
    await render(<MessageView data={text} who={who} contact={null} {...actions} />);
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
      written: { ...text.written, state: "scheduled" as const, dueAt: "2026-11-07T07:18:00Z" },
    };
    await render(<MessageView data={data} who={who} contact={null} {...actions} />);
    await expect.element(page.getByText(stopsFor("2026-11-07T07:18:00Z"))).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.counts.delivered })).not.toBeInTheDocument();
    // No one listed yet, as sending finds who it goes to.
    await expect.element(page.getByText(copy.recipientsWhenSent)).toBeVisible();
    expect(page.getByRole("table").all()).toHaveLength(0);
  });

  it("shows one sending with a bar, no tag, and untitled when it has none", async () => {
    const data = {
      ...exampleMessageSent,
      summary: { ...exampleMessageSummary, state: "sending" as const },
      written: { ...exampleMessageSent.written, state: "sending" as const, title: "" },
    };
    await render(<MessageView data={data} who={who} contact={null} {...actions} />);
    await expect.element(page.getByRole("heading", { name: copy.untitled })).toBeVisible();
    await expect.element(button(staffCopy.mailingPages.stopSending)).toBeVisible();
  });

  it("says who it's from when a name is empty, in a scheduled line", async () => {
    const data = {
      ...exampleMessageSent,
      summary: { ...exampleMessageSummary, state: "scheduled" as const },
      written: {
        ...exampleMessageSent.written,
        state: "scheduled" as const,
        fromName: "",
        dueAt: "2026-11-07T07:18:00Z",
      },
    };
    await render(<MessageView data={data} who={who} contact={null} {...actions} />);
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

describe("MessageFor", () => {
  const actions = {
    ...fakeActions(),
    stop: nothing,
    reschedule: nothing,
  } as unknown as Parameters<typeof MessageFor>[0]["actions"];

  it("shows a draft to write", async () => {
    await render(
      <MessageFor data={{ kind: "draft", draft: exampleMessageEmail, ...exampleMessageData }} actions={actions} />,
    );
    await expect.element(page.getByRole("heading", { name: copy.sections.write })).toBeVisible();
  });

  it("shows one sent", async () => {
    await render(<MessageFor data={exampleMessageSent} actions={actions} />);
    await expect.element(page.getByText(copy.recipientsTitle)).toBeVisible();
  });

  it("says what they said yes to apart, and the other filters as pills, or everyone who did", async () => {
    const supporters = staffCopy.supporters.subscriptions.topics;
    const view = await render(
      <>
        <MessageContact params={{ contact: "phone:luma-calendar:yes" }} />
        <MessageContact params={{ contact: "email:luma-calendar:yes" }} />
        <MessageWho params={{ contact: "email:site-forms:yes", near: "LS1" }} choices={exampleSupporterChoices} />
      </>,
    );
    await expect.element(page.getByText(supporters.phone["luma-calendar"])).toBeVisible();
    await expect.element(page.getByText(supporters.email["luma-calendar"])).toBeVisible();
    const pills = page.getByRole("list", { name: staffCopy.mailingPages.whoLabel }).getByRole("listitem");
    await expect.element(pills.first()).toBeVisible();
    expect(pills.all().map((pill) => pill.element().textContent)).toHaveLength(1);
    await view.unmount();
    await render(<MessageWho params={{ contact: "phone:luma-calendar:yes" }} choices={exampleSupporterChoices} />);
    await expect.element(page.getByText(copy.everyoneWhoSaidYes)).toBeVisible();
  });
});

describe("MessagesOverview", () => {
  const now = "2026-11-05T12:00:00Z";

  it("lists emails and texts, each with its channel, leading to its page", async () => {
    const waiting = {
      ...exampleMessageSummary,
      id: 4,
      state: "scheduled" as const,
      channel: "text" as const,
      title: "Waiting",
    };
    const plain = { ...exampleMessageSummary, id: 6, state: "scheduled" as const, title: "Plain" };
    await render(
      <MessagesOverview
        groups={mailingGroups(
          { drafts: [], comingUp: [waiting, plain], sent: [{ ...exampleMessageSummary, title: "" }] },
          new Date(now),
        )}
        now={now}
      />,
    );
    await expect.element(page.getByRole("link", { name: "Waiting" })).toHaveAttribute("href", "/staff/messages/4");
    await expect.element(page.getByText(copy.channels.text).first()).toBeVisible();
    await expect.element(page.getByText(staffCopy.mailingPages.states.scheduled).first()).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.untitled }).first()).toBeVisible();
    await expect.element(page.getByText(new RegExp(copy.counts.delivered)).first()).toBeVisible();
  });

  it("says when there are none", async () => {
    await render(<MessagesOverview groups={[]} now={now} />);
    await expect.element(page.getByText(copy.none)).toBeVisible();
  });
});

describe("MessageCopyView", () => {
  it("shows a text as the conversation, with the free window, and when it was read", async () => {
    await render(<MessageCopyView one={exampleMessageCopy} reply={nothing} />);
    await expect.element(page.getByRole("heading", { name: "Jane Example" })).toBeVisible();
    await expect.element(page.getByText(copy.copyTag.replied)).toBeVisible();
    await expect.element(page.getByText(/Is it OK to bring my dog/)).toBeVisible();
    await expect.element(page.getByText(/dogs are very welcome/)).toBeVisible();
    await expect.element(page.getByText(copy.replyWindow(staffTime(exampleMessageCopy.replyUntil!)))).toBeVisible();
    await expect.element(page.getByText(copy.lastAnswered("jo@pauseai.uk"))).toBeVisible();
    await expect.element(button(copy.sendReply.text)).toBeEnabled();
    await expect.element(page.getByText(copy.facts.read)).toBeVisible();
  });

  it("closes the box a day after their last message, or until they've written", async () => {
    await render(
      <MessageCopyView one={{ ...exampleMessageCopy, replyUntil: "2026-11-07T08:00:00.000Z" }} reply={nothing} />,
    );
    await expect.element(page.getByText(copy.replyClosed)).toBeVisible();
    await expect.element(button(copy.sendReply.text)).toBeDisabled();
  });

  it("closes the box before a text has been answered", async () => {
    await render(<MessageCopyView one={{ ...exampleMessageCopy, replies: [], replyUntil: null }} reply={nothing} />);
    await expect.element(page.getByText(copy.replyClosed)).toBeVisible();
    await expect.element(page.getByText(copy.facts.replies)).not.toBeInTheDocument();
  });

  it("shows an email as the thread, from us and from them", async () => {
    const one = {
      ...exampleMessageCopy,
      channel: "email" as const,
      subject: "Thank you",
      sentFrom: "hello@pauseai.uk",
      address: "jane@example.com",
      readAt: null,
    };
    await render(<MessageCopyView one={one} reply={nothing} />);
    await expect.element(page.getByRole("article", { name: "Thank you" }).first()).toBeVisible();
    await expect.element(page.getByText(copy.replyEmail)).toBeVisible();
    await expect.element(button(copy.sendReply.email)).toBeEnabled();
    await expect.element(page.getByText(copy.standing.email("Jane Example"))).toBeVisible();
  });

  it("says a reply can't go yet", async () => {
    await render(<MessageCopyView one={{ ...exampleMessageCopy, sends: false }} reply={nothing} />);
    await expect.element(page.getByText(copy.replyCantSend)).toBeVisible();
    await expect.element(button(copy.sendReply.text)).toBeDisabled();
  });

  it("keeps only that one was sent, once they're erased", async () => {
    const one = {
      ...exampleMessageCopy,
      supporterId: null,
      name: null,
      address: null,
      merge: null,
      replies: [],
      status: "skipped",
      skipReason: "blocked",
      sentAt: null,
      deliveredAt: null,
      readAt: null,
    };
    await render(<MessageCopyView one={one} reply={nothing} />);
    await expect.element(page.getByRole("heading", { name: copy.erased })).toBeVisible();
    await expect.element(page.getByText(`Hi {${copy.fieldWords.firstName}}`, { exact: false })).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.everythingElse(copy.erased) })).not.toBeInTheDocument();
  });

  it("names someone with none", async () => {
    await render(
      <MessageCopyView
        one={{ ...exampleMessageCopy, name: null, channel: "email", address: null, replies: [] }}
        reply={nothing}
      />,
    );
    await expect.element(page.getByRole("heading", { name: staffCopy.supporters.noName })).toBeVisible();
  });
});

describe("SupporterMessages", () => {
  it("lists those they were sent, with their replies, leading to each", async () => {
    await render(
      <SupporterMessages
        messages={[
          {
            copyId: 21,
            messageId: 5,
            title: "March day",
            channel: "text",
            status: "delivered",
            skipReason: null,
            sentAt: "2026-11-07T07:18:00Z",
            read: true,
            replies: [{ at: "2026-11-07T07:52:00Z", body: "Great, thanks." }],
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
            replies: [],
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
            replies: [],
          },
        ]}
      />,
    );
    await expect.element(page.getByRole("link", { name: "March day" })).toHaveAttribute("href", "/staff/messages/5");
    await expect
      .element(page.getByRole("link", { name: copy.messageAndReply }).first())
      .toHaveAttribute("href", "/staff/messages/5/21");
    // One went to each of the two that went; the one stopped has no page of its own.
    await expect.poll(() => page.getByRole("link", { name: copy.messageAndReply }).elements().length).toBe(2);
    await expect.element(page.getByText(/Great, thanks/)).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.untitled })).toBeVisible();
  });

  it("says when there are none", async () => {
    await render(<SupporterMessages messages={[]} />);
    await expect.element(page.getByText(copy.supporterNone)).toBeVisible();
  });
});
