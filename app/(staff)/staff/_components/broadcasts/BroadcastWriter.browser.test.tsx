import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import type { WhatsAppTemplate } from "@/lib/broadcasts/drafts.server";
import { staffTime } from "@/lib/staff-time";
import { textCost } from "@/lib/broadcasts/broadcasts";
import { SENDING_DAYS } from "@/lib/broadcasts/days";
import { GMAIL_DAILY_LIMIT } from "@/lib/email/gmail-connect";
import { chooseDay } from "@/tests/browser/date-picker";
import { navigation } from "@/tests/browser/navigation";
import { EMPTY_MAILING_DOC } from "@/lib/mailings/doc";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import BroadcastWriter, { templateLine, type BroadcastWriterActions } from "./BroadcastWriter";
import ChannelWriter from "./ChannelWriter";
import {
  exampleBroadcastData,
  exampleBroadcastEmail,
  exampleBroadcastText,
  exampleTemplates,
  exampleTextSender,
  exampleTextWords,
} from "./BroadcastWriter.examples";
import { supportersCopy } from "../supporters/copy";
import { mailingsCopy } from "../mailings/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { BroadcastWriterExample } from "./BroadcastWriter.gallery.client";

const { leavePage } = vi.hoisted(() => ({ leavePage: vi.fn() }));
vi.mock("@/lib/leave-page.client", () => ({ leavePage }));
afterEach(() => leavePage.mockClear());

const copy = broadcastsCopy.broadcastPages;
const WAIT = { timeout: 3000 };

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
  const consents = supportersCopy.supporters.subscriptions.consents;
  // Email or text, one of them; Said yes to, one of its topics, or after + Add, any of them, toggled.
  const toggled = (name: string) =>
    name === copy.facts.saidYes &&
    [...document.querySelectorAll("fieldset")]
      .filter((field) => field.querySelector("legend")!.textContent === name)
      .at(-1)
      ?.textContent!.endsWith(staffVocabulary.filters.justOne) === true;
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
  const add = () => page.getByRole("button", { name: staffVocabulary.filters.addChoice }).click();
  const justOne = () => page.getByRole("button", { name: staffVocabulary.filters.justOne }).click();

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
    await page.getByRole("button", { name: staffVocabulary.filters.justOne }).last().click();
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
    expect(page.getByText(mailingsCopy.mailingPages.savePill.saved).query()).toBeNull();
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
    expect(page.getByRole("link", { name: mailingsCopy.mailingPages.changeWho }).query()).toBeNull();
  });

  it("goes to the list to change who, with the draft's filter and saved first", async () => {
    await renderWriter();
    await page.getByRole("link", { name: mailingsCopy.mailingPages.changeWho }).click();
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
      [mailingsCopy.mailingPages.fromOption("hello@pauseai.uk", mailingsCopy.mailingPages.sendBy.names.gmail), false],
      [mailingsCopy.mailingPages.fromOption("hello@pauseai.uk", mailingsCopy.mailingPages.sendBy.names.postmark), true],
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
    await expect.element(send.getByText(mailingsCopy.mailingPages.sendBy.names.gmail, { exact: true })).toBeVisible();
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
    await expect.element(page.getByText(mailingsCopy.mailingPages.saveStates.conflict)).toBeVisible();
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
    await page.getByLabelText(mailingsCopy.mailingPages.hour, { exact: false }).selectOptions("14");
    await vi.waitFor(() => expect(actions.save.mock.calls.at(-1)?.[2]).toHaveProperty("dueAt"), WAIT);
  });

  it("waits for an hour before it has a time", async () => {
    const actions = await renderWriter({ draft: { ...exampleBroadcastEmail, dueAt: null } });
    await expect.element(page.getByText(copy.problems["no-time"])).toBeVisible();
    const when = page.getByRole("region", { name: copy.sections.when });
    const soon = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await chooseDay(when.getByRole("button", { name: mailingsCopy.mailingPages.day }), soon);
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
    await expect.element(page.getByText(mailingsCopy.mailingEditor.partsHeading)).not.toBeInTheDocument();
    await page.getByLabelText(copy.templateName).fill("March day");
    await page.getByRole("textbox", { name: copy.templateWords }).fill("See you at the march");
    // WhatsApp's formatting: bold, italic, lists and quotes, but no links, by button or by key.
    const editing = mailingsCopy.mailingEditor;
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
    // Refused here: an alert says why, and the button stays, to be pressed again.
    actions.submitTemplate.mockResolvedValue("already");
    await button(copy.submitTemplate).click();
    await vi.waitFor(() => expect(actions.submitTemplate).toHaveBeenCalledWith(4), WAIT);
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.submitRefused.already);
    await expect.element(button(copy.submitTemplate)).toBeEnabled();
    expect(navigation.pushed).toEqual([]);
    // WhatsApp didn't take them: its reason, or that it gave none.
    actions.submitTemplate.mockResolvedValue({ failed: "Invalid parameter" });
    await button(copy.submitTemplate).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.submitFailed("Invalid parameter"));
    actions.submitTemplate.mockResolvedValue({ failed: null });
    await button(copy.submitTemplate).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.submitFailed(null));
    // The action itself broke.
    actions.submitTemplate.mockRejectedValue(new Error("Server Action failed"));
    await button(copy.submitTemplate).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.submitBroke);
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
      .element(page.getByText(copy.rejected(broadcastsCopy.notifications.templateRejectedWhy.reasons.INVALID_FORMAT!)))
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
    await expect.element(page.getByText(mailingsCopy.mailingPages.sendFacts.whatsApp, { exact: true })).toBeVisible();
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
    await expect.element(page.getByText(mailingsCopy.mailingPages.sendFacts.noTime)).toBeVisible();
    // And it can't be scheduled till there's one.
    await expect.element(page.getByText(copy.problems["no-number"])).toBeVisible();
  });
});

describe("BroadcastWriter's examples in the gallery", () => {
  it("logs a draft's actions", async () => {
    await render(<BroadcastWriterExample kind="email" />);
    await page.getByLabelText(copy.subject).fill("Changed");
    await page.getByRole("button", { name: copy.sendTest }).click();
    const log = page.getByRole("list", { name: "Event log" }).getByRole("listitem");
    await expect.element(log.nth(0)).toHaveTextContent('saveBroadcast(3, 4, {"subject":"Changed"})');
    // Filled in for someone made up, meeting what the preview's buttons say.
    await expect
      .element(page.getByText(/^sendBroadcastTestNow\(3, \["has:firstName",.*"jo@pauseai\.uk"\)$/))
      .toBeVisible();
  });

  it("draws each kind of writer", async () => {
    for (const kind of ["choose", "template", "new", "rejected", "off"] as const) {
      const view = await render(<BroadcastWriterExample kind={kind} />);
      await expect.element(page.getByRole("heading", { name: copy.sections.write })).toBeVisible();
      await view.unmount();
    }
  });
});
