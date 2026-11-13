import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { staffCopy } from "@/lib/content/staff-interface";
import { mailingGroups } from "@/lib/mailing-groups";
import type { WhatsAppTemplate } from "@/lib/server/broadcast-drafts";
import type { BroadcastSummary } from "@/lib/server/broadcast-pages";
import { supportersSearch } from "@/lib/staff-search";
import { londonWhen, staffTime } from "@/lib/staff-time";
import { textCost } from "@/lib/broadcasts";
import { SENDING_DAYS } from "@/lib/broadcast-days";
import { GMAIL_DAILY_LIMIT } from "@/lib/gmail-connect";
import { chooseDay } from "@/tests/browser/date-picker";
import { navigation } from "@/tests/browser/navigation";
import { EMPTY_MAILING_DOC } from "@/lib/mailing-doc";
import MessageCopyView from "./MessageCopyView";
import BroadcastFor, { BroadcastContact, BroadcastWho } from "./BroadcastFor";
import { ChoosingBroadcastFrame, BroadcastSupporters } from "./BroadcastSupporters";
import BroadcastView, { broadcastCounts } from "./BroadcastView";
import { CountGroups, NeedsAndFine } from "./CopyCounts";
import { CopyStatus, copyStatus } from "./CopyStatus";
import { countsOpening } from "./ui/Counts";
import { TEMPLATE_FOOTER } from "@/lib/whatsapp-template";
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
  exampleTextSender,
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
const stateWords = staffCopy.copyStates;
const WAIT = { timeout: 3000 };
const nothing = async () => {};

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
    setAboutEvents: action(() => true),
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
  const consents = staffCopy.supporters.subscriptions.consents;
  // Email or text, one of them; Said yes to, one of its topics, or after + Add, any of them, toggled.
  const toggled = (name: string) =>
    name === copy.facts.saidYes &&
    [...document.querySelectorAll("fieldset")]
      .filter((field) => field.querySelector("legend")!.textContent === name)
      .at(-1)
      ?.textContent!.endsWith(staffCopy.filters.justOne) === true;
  // Said yes to's toggles are a group inside the field's own group of that name.
  const group = (name: string) =>
    toggled(name)
      ? page.getByRole("group", { name }).getByRole("group", { name }).last()
      : page.getByRole("radiogroup", { name }).last();
  const radios = (name: string) =>
    [...group(name).element().querySelectorAll("button")].map((b) => [
      b.textContent,
      b.getAttribute(toggled(name) ? "aria-pressed" : "aria-checked") === "true",
      (b as HTMLButtonElement).disabled,
    ]);
  const choose = (within: string, name: string) =>
    group(within)
      .getByRole(toggled(within) ? "button" : "radio", { name })
      .click();
  const add = () => page.getByRole("button", { name: staffCopy.filters.addChoice }).click();
  const justOne = () => page.getByRole("button", { name: staffCopy.filters.justOne }).click();

  it("asks email or text, then offers that channel's Consents in a row, its own chosen, the other channel shut once it has words", async () => {
    await renderWriter();
    expect(radios(copy.consentChannel)).toEqual([
      [copy.channels.email, true, false],
      [copy.channels.text, false, true],
    ]);
    // One of them, chosen…
    expect(radios(copy.facts.saidYes)).toEqual([
      [consents["email:newsletter"], true, false],
      [consents["email:events"], false, false],
      [consents["email:volunteering"], false, false],
    ]);
    // …or, after + Add, any of them, "or" between each.
    await add();
    expect(radios(copy.facts.saidYes)).toEqual([
      [consents["email:newsletter"], true, false],
      [consents["email:events"], false, false],
      [consents["email:volunteering"], false, false],
    ]);
    expect(group(copy.facts.saidYes).element().textContent).toBe(
      [consents["email:newsletter"], consents["email:events"], consents["email:volunteering"]].join("or"),
    );
  });

  it("swaps its one topic for another, but not for the one it has", async () => {
    const actions = await renderWriter();
    await choose(copy.facts.saidYes, consents["email:newsletter"]);
    await choose(copy.facts.saidYes, consents["email:events"]);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledWith(3, "email:events:yes"), WAIT);
    expect(actions.changeConsent).toHaveBeenCalledTimes(1);
  });

  it("with several, offers them all, and Just one keeps the first; with one, Just one only goes back", async () => {
    const actions = await renderWriter({
      draft: {
        ...exampleBroadcastEmail,
        topics: ["newsletter", "events"],
        filter: { list: "supporters", params: { contact: ["email:newsletter:yes", "email:events:yes"] } },
      },
    });
    await justOne();
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledWith(3, "email:newsletter:yes"), WAIT);
    await renderWriter();
    await add();
    await page.getByRole("button", { name: staffCopy.filters.justOne }).last().click();
    expect(radios(copy.facts.saidYes).map(([, on]) => on)).toEqual([true, false, false]);
    expect(actions.changeConsent).toHaveBeenCalledTimes(1);
  });

  it("adds a topic to those it goes under, and takes one off, but not the last", async () => {
    const actions = await renderWriter({
      draft: {
        ...exampleBroadcastEmail,
        topics: ["newsletter", "events"],
        filter: { list: "supporters", params: { contact: ["email:newsletter:yes", "email:events:yes"] } },
      },
    });
    expect(radios(copy.facts.saidYes).map(([, on]) => on)).toEqual([true, true, false]);
    await choose(copy.facts.saidYes, consents["email:volunteering"]);
    await vi.waitFor(
      () =>
        expect(actions.changeConsent).toHaveBeenCalledWith(
          3,
          "email:newsletter:yes email:events:yes email:volunteering:yes",
        ),
      WAIT,
    );
    await choose(copy.facts.saidYes, consents["email:newsletter"]);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledWith(3, "email:events:yes"), WAIT);
    await renderWriter();
    await choose(copy.facts.saidYes, consents["email:newsletter"]);
    expect(actions.changeConsent).toHaveBeenCalledTimes(2);
  });

  it("offers either channel to one with no words of its own, showing the other's Consents without changing it", async () => {
    const actions = await renderWriter({ draft: { ...exampleBroadcastEmail, subject: "", body: EMPTY_MAILING_DOC } });
    await choose(copy.consentChannel, copy.channels.text);
    await vi.waitFor(
      () =>
        expect(radios(copy.facts.saidYes).map(([name]) => name)).toEqual([
          consents["text:newsletter"],
          consents["text:events"],
          consents["text:volunteering"],
        ]),
      WAIT,
    );
    expect(radios(copy.facts.saidYes).every(([, checked, disabled]) => !checked && !disabled)).toBe(true);
    expect(actions.changeConsent).not.toHaveBeenCalled();
  });

  it("saves what's typed, changes the Consent, and shows the draft as it is then", async () => {
    const actions = await renderWriter();
    const refreshes = navigation.refreshes;
    // The only one it has: it stays.
    await choose(copy.facts.saidYes, consents["email:newsletter"]);
    await choose(copy.facts.saidYes, consents["email:events"]);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledWith(3, "email:events:yes"), WAIT);
    expect(actions.changeConsent).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(navigation.refreshes).toBeGreaterThan(refreshes), WAIT);
    // Refused, nothing to show again.
    actions.changeConsent.mockResolvedValue(false);
    const before = navigation.refreshes;
    await choose(copy.facts.saidYes, consents["email:events"]);
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
    await choose(copy.facts.saidYes, consents["text:events"]);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledWith(3, "text:events:yes"), WAIT);
    expect(actions.create).not.toHaveBeenCalled();
  });

  it("on a text's draft, shows it as it is, by text", async () => {
    const actions = fakeActions();
    await render(
      <ChannelWriter
        data={exampleBroadcastData}
        draft={exampleBroadcastText}
        who={<p>Who</p>}
        actions={actions as unknown as BroadcastWriterActions}
      />,
    );
    expect(radios(copy.consentChannel)[1]).toEqual([copy.channels.text, true, false]);
    expect(page.getByLabelText(copy.subject, { exact: true }).query()).toBeNull();
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
    await choose(copy.facts.saidYes, consents["text:events"]);
    await vi.waitFor(() => expect(actions.create).toHaveBeenCalledWith("text:events:yes"), WAIT);
    expect(actions.save).not.toHaveBeenCalled();
  });
});

describe("BroadcastWriter, by email", () => {
  it("shows the six sections, what it'll cost, and schedules", async () => {
    const actions = await renderWriter();
    await expect.element(page.getByRole("heading", { name: exampleBroadcastEmail.subject, level: 1 })).toBeVisible();
    await expect.element(page.getByText(copy.willGet(412, "email"))).toBeVisible();
    // An email's cost goes unsaid: a few pennies.
    expect(page.getByText(/About [$£]/).query()).toBeNull();
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

  it("offers to narrow down everyone who said yes, and to change who once they're narrowed", async () => {
    await renderWriter({
      data: { ...exampleBroadcastData, filter: { list: "supporters", params: { contact: "email:newsletter:yes" } } },
    });
    await expect.element(page.getByRole("link", { name: copy.narrowDown })).toBeVisible();
    expect(page.getByRole("link", { name: staffCopy.mailingPages.changeWho }).query()).toBeNull();
  });

  it("goes to the list to change who, with the draft's filter and saved first", async () => {
    await renderWriter();
    await page.getByRole("link", { name: staffCopy.mailingPages.changeWho }).click();
    await vi.waitFor(() =>
      expect(leavePage).toHaveBeenCalledWith("/staff/supporters?contact=email%3Anewsletter%3Ayes&near=LS1&broadcast=3"),
    );
  });

  it("shows someone made up, any mix of fields and parts a press away, each field's fallback when they lack it", async () => {
    await renderWriter();
    const wrote = button(copy.conditions.wrote("Regulate AI"));
    const named = button(copy.previewCases["has:name"]);
    // Never a real supporter: the made-up one, with everything to start with, so not asked to write.
    await expect.element(page.getByText("Jane Smith <jane.smith@example.com>")).toBeVisible();
    await expect.element(wrote).toHaveAttribute("aria-pressed", "true");
    const preview = page.getByRole("region", { name: copy.sections.preview });
    await expect.element(preview.getByText("Could you write to your MP?")).not.toBeInTheDocument();
    await wrote.click();
    await expect.element(wrote).toHaveAttribute("aria-pressed", "false");
    await expect.element(preview.getByText("Could you write to your MP?")).toBeVisible();
    await named.click();
    await expect.element(page.getByText(`See you soon, ${copy.fallbacks.name}.`).first()).toBeVisible();
    await named.click();
    await expect.element(page.getByText("See you soon, Jane Smith.").first()).toBeVisible();
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

  it("goes from hello@ by its Gmail, Postmark greyed out, its name fixed, and says what it can send today", async () => {
    await renderWriter();
    const account = page.getByLabelText(copy.fromAccount, { exact: false });
    await expect.element(account).toHaveValue("gmail");
    const options = [...account.element().querySelectorAll("option")].map((o) => [o.textContent, o.disabled]);
    expect(options).toEqual([
      [copy.fromOption("hello@pauseai.uk", copy.sendBy.names.gmail), false],
      [copy.fromOption("hello@pauseai.uk", copy.sendBy.names.postmark), true],
    ]);
    // The name isn't a field.
    await expect.element(page.getByRole("textbox", { name: copy.fromName })).not.toBeInTheDocument();
    // Enough left today for all it goes to.
    await expect.element(page.getByText(copy.sendBy.room("hello@pauseai.uk", 1788, 1))).toBeVisible();
    // The test goes the same way.
    await expect.element(page.getByText(copy.testVia.emailGmail("hello@pauseai.uk"))).toBeVisible();
    await account.selectOptions("gmail");
    await expect.element(account).toHaveValue("gmail");
  });

  it("is from PauseAI UK with no name of its own: Send has the address, the name under it, then by what", async () => {
    await renderWriter({ draft: { ...exampleBroadcastEmail, fromName: null } });
    const send = page.getByLabelText("6Send", { exact: false });
    await expect.element(send.getByText("hello@pauseai.uk", { exact: true })).toBeVisible();
    await expect.element(send.getByText("PauseAI UK", { exact: true })).toBeVisible();
    await expect.element(send.getByText(copy.sendBy.names.gmail, { exact: true })).toBeVisible();
  });

  it("says how many days it takes to more than hello@ can send today, and won't schedule over its sending days", async () => {
    await renderWriter({ data: { ...exampleBroadcastData, count: 3000 } });
    await expect.element(page.getByText(copy.sendBy.room("hello@pauseai.uk", 1788, 2))).toBeVisible();
    expect(document.body.textContent).not.toContain(copy.problems["too-slow"]);
    const most = 1788 + (SENDING_DAYS - 1) * GMAIL_DAILY_LIMIT;
    await renderWriter({ data: { ...exampleBroadcastData, count: most } });
    expect(document.body.textContent).not.toContain(copy.problems["too-slow"]);
    await renderWriter({ data: { ...exampleBroadcastData, count: most + 1 } });
    await expect.element(page.getByText(copy.problems["too-slow"])).toBeVisible();
  });

  it("says hello@'s Gmail isn't connected, when its test goes by Postmark", async () => {
    await renderWriter({
      data: { ...exampleBroadcastData, sender: { byGmail: true, connected: false, remaining: 1800, daily: 1800 } },
    });
    await expect.element(page.getByText(copy.sendBy.notConnected("hello@pauseai.uk"))).toBeVisible();
    await expect.element(page.getByText(copy.problems["not-connected"])).toBeVisible();
    await expect.element(page.getByText(copy.testVia.email("hello@pauseai.uk"))).toBeVisible();
  });

  it("says how many more people our WhatsApp number can text today, and how long a text takes, held to its days", async () => {
    const text = (count: number, sender = exampleTextSender) =>
      renderWriter({ draft: exampleBroadcastText, data: { ...exampleBroadcastData, count, sender } });
    await text(412);
    await expect.element(page.getByText(copy.textRoom(238, 2))).toBeVisible();
    await text(200);
    await expect.element(page.getByText(copy.textRoom(238, 1))).toBeVisible();
    // At the top tier, however many.
    await text(50_000, { ...exampleTextSender, remaining: null, daily: null });
    await expect.element(page.getByText(copy.textRoom(null, 1))).toBeVisible();
    expect(document.body.textContent).not.toContain(copy.problems["too-slow"]);
    const most = 238 + (SENDING_DAYS - 1) * 250;
    await text(most + 1);
    await expect.element(page.getByText(copy.problems["too-slow"])).toBeVisible();
  });

  it("says when no one's left to send to, and when the filter's values are gone", async () => {
    await renderWriter({
      data: { ...exampleBroadcastData, count: 0, unknown: ["event=gone"] },
    });
    await expect.element(page.getByText(/event=gone/)).toBeVisible();
    await expect.element(page.getByText(copy.problems["no-recipients"])).toBeVisible();
  });

  it("can't be scheduled where nothing sends it, and says someone saved it meanwhile", async () => {
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
    await expect.element(button(copy.schedule(412, "email"))).toBeDisabled();
    await page.getByLabelText(copy.subject).fill("Changed");
    await expect.element(page.getByText(staffCopy.mailingPages.saveStates.conflict)).toBeVisible();
  });

  it("saves what's written and the time chosen", async () => {
    const actions = await renderWriter();
    // Into a line of words, not onto a field's chip or a part's box, which can't be typed in.
    await page
      .getByRole("textbox", { name: copy.emailLabel })
      .getByText("Here's what's on near you this month.")
      .click();
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
    await expect
      .element(
        page.getByLabelText("2Sent from", { exact: false }).getByText("07700 900000, by WhatsApp", { exact: true }),
      )
      .toBeVisible();
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

  it("says a template made in WhatsApp Manager was made there", async () => {
    await renderWriter({ draft: exampleBroadcastText });
    await pick("2");
    await expect.element(page.getByText(templateLine(exampleTemplates[1]))).toBeVisible();
    expect(templateLine(exampleTemplates[1])).toContain(copy.templateMadeIn);
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
    await expect.element(page.getByText(copy.problems["not-approved"])).toBeVisible();
    await expect.element(page.getByText(copy.testVia.textNew)).toBeVisible();
    await expect.element(button(copy.sendTest)).toBeDisabled();
    // In Schedule's place, as it can't be scheduled till WhatsApp approves.
    expect(button(copy.schedule(412, "text")).query()).toBeNull();
    // Refused: it stays, to be pressed again.
    actions.submitTemplate.mockResolvedValue("already");
    await button(copy.submitTemplate).click();
    await vi.waitFor(() => expect(actions.submitTemplate).toHaveBeenCalledWith(4), WAIT);
    await expect.element(button(copy.submitTemplate)).toBeEnabled();
    expect(navigation.pushed).toEqual([]);
    await expect.element(page.getByText(copy.submitFailed)).not.toBeInTheDocument();
    // WhatsApp didn't take them: it says so, to press again.
    actions.submitTemplate.mockResolvedValue("failed");
    await button(copy.submitTemplate).click();
    await expect.element(page.getByText(copy.submitFailed)).toBeVisible();
    await expect.element(button(copy.submitTemplate)).toBeEnabled();
    // Sent: back to the list, where its row pulses.
    actions.submitTemplate.mockResolvedValue("submitted");
    await button(copy.submitTemplate).click();
    await vi.waitFor(() => expect(navigation.pushed).toEqual(["/staff/broadcasts?submitted=4"]), WAIT);
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
    // And at the top, in amber, as the words are locked till WhatsApp decides.
    await expect
      .element(page.getByText(copy.awaitingApproval("jo@pauseai.uk", staffTime(template.requestedAt))))
      .toBeVisible();
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

  it("brings Write fully into view once the words are taken back", async () => {
    const template = { ...exampleTemplates[0], status: "pending" as const, approvedAt: null, name: "Hi there" };
    const actions = fakeActions();
    const writer = (withTemplate: typeof template | null) => (
      <BroadcastWriter
        data={exampleBroadcastData}
        draft={{ ...exampleBroadcastText, body: exampleTextWords, template: withTemplate }}
        who={<p>Who</p>}
        actions={actions as unknown as BroadcastWriterActions}
      />
    );
    const screen = await render(writer(template));
    const scrolled = vi.spyOn(Element.prototype, "scrollIntoView");
    await button(copy.withdrawTemplate).click();
    await button(copy.withdrawSure).click();
    await vi.waitFor(() => expect(actions.withdrawTemplate).toHaveBeenCalledWith(4), WAIT);
    // Not until the page has the words back.
    expect(scrolled).not.toHaveBeenCalled();
    await screen.rerender(writer(null));
    await vi.waitFor(() => expect(scrolled).toHaveBeenCalledWith({ block: "start", behavior: "instant" }), WAIT);
    expect(scrolled.mock.contexts[0]).toBe(document.querySelector('[aria-labelledby="write-title"]'));
    scrolled.mockRestore();
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
      rejectedReason: "INVALID_FORMAT",
    };
    await renderWriter({ draft: { ...exampleBroadcastText, body: exampleTextWords, template } });
    // WhatsApp's code in plain words, as the email of it says it.
    await expect
      .element(page.getByText(copy.rejected(staffCopy.notifications.templateRejectedWhy.reasons.INVALID_FORMAT!)))
      .toBeVisible();
  });

  it("previews a bubble, and sends a test to a number only on an approved template", async () => {
    const actions = await renderWriter({ draft: onTemplate });
    // Its footer, saying a reply of stop stops these texts.
    await expect.element(page.getByText(TEMPLATE_FOOTER, { exact: true })).toBeVisible();
    await expect.element(page.getByText(/Hi Jane, the march meets/)).toBeVisible();
    // What they'll cost, and the rate, as it may have changed.
    await expect.element(page.getByText(textCost(exampleBroadcastData.count).rate)).toBeVisible();
    // What will go names the WhatsApp number it's from, the name under it.
    const send = page.getByLabelText("6Send", { exact: false });
    await expect.element(send.getByText("07700 900000", { exact: true })).toBeVisible();
    await expect.element(send.getByText("PauseAI UK", { exact: true })).toBeVisible();
    await expect.element(page.getByText(copy.sendFacts.whatsApp, { exact: true })).toBeVisible();
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
    // With no number, it's from the name alone, with no time yet.
    await expect
      .element(page.getByLabelText("6Send", { exact: false }).getByText("PauseAI UK", { exact: true }))
      .toBeVisible();
    await expect.element(page.getByText(copy.sendFacts.noTime)).toBeVisible();
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
    await render(<TextBubble from="PauseAI UK" words={exampleWhatsAppWords} footer={TEMPLATE_FOOTER} time="07:18" />);
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
  const yes = supportersSearch({ contact: "email:newsletter:yes", near: "LS1" });
  const none = supportersSearch({ near: "LS1" });

  it("starts a broadcast to those found with a Consent filter answered yes, keeping who they are", async () => {
    await render(<BroadcastSupporters search={yes} total={430} action={nothing} />);
    await expect.element(button(copy.broadcastButton(430))).toBeVisible();
    expect(document.querySelector<HTMLInputElement>('input[name="contact"]')!.value).toBe("email:newsletter:yes");
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
      topics: ["newsletter" as const],
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
      topics: ["newsletter" as const],
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
    await expect.element(page.getByText(staffCopy.campaigns.supporters(290), { exact: true })).toBeVisible();
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
    await expect.element(page.getByRole("link", { name: staffCopy.supporters.noName })).toBeVisible();
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
    await expect.element(page.getByRole("link", { name: staffCopy.mailingPages.showEveryone }).first()).toBeVisible();
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
      .element(page.getByText(staffCopy.mailingPages.sends(londonWhen(new Date("2026-11-07T07:18:00Z"), "short"))))
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
      .element(page.getByText(staffCopy.mailingPages.sends(londonWhen(due, "short"))))
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
    await button(copy.resume).click();
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

describe("BroadcastFor", () => {
  const actions = {
    ...fakeActions(),
    stop: nothing,
    reschedule: nothing,
    resume: nothing,
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
    const supporters = staffCopy.supporters.subscriptions.consents;
    const view = await render(
      <>
        <p>
          <BroadcastContact params={{ contact: "text:events:yes" }} />
        </p>
        <p>
          <BroadcastContact params={{ contact: "email:events:yes" }} />
        </p>
        <p>
          <BroadcastContact params={{ contact: ["email:newsletter:yes", "email:events:yes"] }} />
        </p>
        <BroadcastWho params={{ contact: "email:newsletter:yes", near: "LS1" }} choices={exampleSupporterChoices} />
      </>,
    );
    await expect.element(page.getByText(supporters["text:events"])).toBeVisible();
    await expect.element(page.getByText(supporters["email:events"])).toBeVisible();
    await expect
      .element(page.getByText(staffCopy.filters.anyOf([supporters["email:newsletter"], supporters["email:events"]])))
      .toBeVisible();
    const pills = page.getByRole("list", { name: staffCopy.mailingPages.whoLabel }).getByRole("listitem");
    await expect.element(pills.first()).toBeVisible();
    expect(pills.all().map((pill) => pill.element().textContent)).toHaveLength(1);
    await view.unmount();
    await render(<BroadcastWho params={{ contact: "text:events:yes" }} choices={exampleSupporterChoices} />);
    await expect.element(page.getByText(copy.everyoneWhoSaidYes)).toBeVisible();
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
          // With a count that doesn't apply, as an email's read: none to add.
          { key: "went", label: "went", counts: [...all.slice(0, 6), { key: "none", n: null, label: "none" }] },
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

describe("BroadcastsOverview", () => {
  const now = "2026-11-05T12:00:00Z";

  it("shows, under one sending's bar, what needs a look already, in colour, each leading to its tab", async () => {
    const sending = (id: number, title: string, more: Partial<BroadcastSummary>): BroadcastSummary => ({
      ...exampleBroadcastSummary,
      id,
      title,
      state: "sending",
      dueAt: new Date("2026-11-05T11:00:00Z"),
      to: 7,
      sent: 4,
      failed: 0,
      states: { ...exampleBroadcastSummary.states, "opted-out": 0, error: 0, unreached: 0, look: 0 },
      ...more,
    });
    await render(
      <BroadcastsOverview
        groups={mailingGroups<BroadcastSummary>(
          {
            drafts: [],
            comingUp: [
              sending(4, "Going badly", {
                states: { ...exampleBroadcastSummary.states, "opted-out": 1, error: 2, unreached: 0, look: 1 },
              }),
              sending(6, "Going well", {}),
            ],
            sent: [],
          },
          new Date(now),
        )}
        now={now}
      />,
    );
    await expect.element(page.getByText(staffCopy.mailingPages.sendingBar(4, 7)).first()).toBeVisible();
    const need = (words: string) => page.getByRole("link", { name: words, exact: true });
    await expect.element(need(`2 ${stateWords.counts.error}`)).toHaveAttribute("href", "/staff/broadcasts/4?tab=error");
    await expect
      .element(need(`1 ${stateWords.counts["opted-out"]}`))
      .toHaveAttribute("href", "/staff/broadcasts/4?tab=opted-out");
    await expect.element(need(`1 ${stateWords.counts.look}`)).toHaveAttribute("href", "/staff/broadcasts/4?tab=look");
    // Nothing to look at, nothing under the bar.
    expect(page.getByRole("link", { name: new RegExp(stateWords.counts.error!) }).elements()).toHaveLength(1);
  });

  it("lists emails and texts, each with its channel, leading to its page", async () => {
    const waiting = {
      ...exampleBroadcastSummary,
      id: 4,
      state: "scheduled" as const,
      channel: "text" as const,
      title: "Waiting",
      sentFrom: "+447700900000",
    };
    const plain = { ...exampleBroadcastSummary, id: 6, state: "scheduled" as const, title: "Plain" };
    const held = {
      ...exampleBroadcastSummary,
      id: 8,
      state: "draft" as const,
      title: "Held",
      waiting: true,
      sentFrom: null,
      fromName: null,
    };
    const turnedDown = {
      ...exampleBroadcastSummary,
      id: 9,
      state: "draft" as const,
      title: "Turned down",
      rejected: true,
    };
    await render(
      <BroadcastsOverview
        groups={mailingGroups<BroadcastSummary>(
          {
            drafts: [held, turnedDown],
            comingUp: [waiting, plain],
            // By Postmark, so it counts what arrived.
            sent: [
              {
                ...exampleBroadcastSummary,
                title: "",
                sendBy: "postmark" as const,
                states: { ...exampleBroadcastSummary.states, delivered: 276 },
              },
            ],
          },
          new Date(now),
        )}
        now={now}
      />,
    );
    await expect.element(page.getByRole("link", { name: "Waiting" })).toHaveAttribute("href", "/staff/broadcasts/4");
    // Its channel's icon before its title, named.
    await expect.element(page.getByRole("img", { name: copy.channels.text }).first()).toBeVisible();
    await expect.element(page.getByRole("img", { name: copy.channels.email }).first()).toBeVisible();
    // Under the title, its channel's name, then who it's from, a dot between.
    const lineUnder = (title: string) =>
      page.getByRole("link", { name: title }).element().parentElement!.nextElementSibling!;
    expect(lineUnder("Waiting").textContent).toBe(`${copy.channels.text} · PauseAI UK · 07700 900000`);
    // With no one it's from yet, its channel alone.
    expect(lineUnder("Held").textContent).toBe(copy.channels.email);
    // Where each stands, as a sentence: a draft whose words WhatsApp is reviewing.
    await expect.element(page.getByText(copy.standing.waiting)).toBeVisible();
    // And one whose words it rejected, till they're sent again.
    await expect.element(page.getByText(copy.standing.rejected)).toBeVisible();
    expect(page.getByText(copy.standing.rejected).all()).toHaveLength(1);
    await expect.element(page.getByText(copy.standing.scheduled(290)).first()).toBeVisible();
    await expect.element(page.getByRole("link", { name: copy.untitled }).first()).toBeVisible();
    // One sent: how many it went to; then what needs a look, the rest folded behind how many are fine.
    await expect.element(page.getByText(copy.standing.sent(290))).toBeVisible();
    await expect.element(page.getByRole("link", { name: `4 ${stateWords.counts.error}` })).toBeVisible();
    await expect.element(page.getByRole("button", { name: / fine/ }).first()).toBeVisible();
  });

  it("says where each one that went stands: sent, stopped by us, or stopped by itself and why", async () => {
    const went = (id: number, title: string, more: Partial<BroadcastSummary>): BroadcastSummary => ({
      ...exampleBroadcastSummary,
      id,
      title,
      to: 5,
      sent: 3,
      ...more,
    });
    const stopped = { state: "cancelled" as const };
    const gaveUp = (waitReason: string) => ({ state: "cancelled" as const, gaveUp: true, waitReason });
    await render(
      <BroadcastsOverview
        groups={mailingGroups<BroadcastSummary>(
          {
            drafts: [],
            comingUp: [],
            sent: [
              went(1, "Sent", { state: "sent" }),
              went(2, "Stopped by us", stopped),
              went(3, "Out of time", gaveUp("limit")),
              went(4, "CiviCRM down", gaveUp("civicrm")),
              went(5, "No pull", gaveUp("pull")),
              went(6, "Template paused", gaveUp("template")),
              went(7, "Late", gaveUp("late")),
              went(8, "Failing", gaveUp("failing")),
            ],
          },
          new Date(now),
        )}
        now={now}
      />,
    );
    const words = copy.standing;
    for (const said of [
      words.sent(5),
      words.stopped(3, 5),
      words.gaveUp.limit!(3, 5),
      words.gaveUp.template!(3, 5),
      words.gaveUp.late!(3, 5),
      words.gaveUp.failing!(3, 5),
    ]) {
      await expect.element(page.getByText(said)).toBeVisible();
    }
    // CiviCRM down, or no fresh pull from it, read the same.
    expect(page.getByText(words.gaveUp.civicrm!(3, 5)).all()).toHaveLength(2);
    expect(words.gaveUp.pull!(3, 5)).toBe(words.gaveUp.civicrm!(3, 5));
  });

  it("says when there are none", async () => {
    await render(<BroadcastsOverview groups={[]} now={now} />);
    await expect.element(page.getByText(copy.none)).toBeVisible();
  });
});

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
    expect(strip()).toBe(copy.notReached.refused(copy.sendBy.names.postmark));
    for (const [status, words] of [
      ["failed", copy.notReached.refused(copy.sendFacts.whatsApp)],
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
    const history = page.getByRole("list", { name: staffCopy.letters.detail.historyTitle });
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
    await expect.element(page.getByText(staffCopy.letters.detail.noHistory)).toBeVisible();
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
      .toHaveTextContent(copy.copyTitle("email", staffCopy.supporters.noName));
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
            state: "read",
            why: null,
          },
          {
            copyId: 22,
            messageId: 6,
            title: "",
            channel: "email",
            status: "failed",
            skipReason: null,
            sentAt: null,
            state: "error",
            why: "gmail",
          },
          {
            copyId: 23,
            messageId: 7,
            title: "Stopped",
            channel: "email",
            status: "cancelled",
            skipReason: null,
            sentAt: null,
            state: "not-sent",
            why: "cancelled",
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
