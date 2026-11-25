import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
import { staffVocabulary } from "@/lib/staff-vocabulary";
import type { WhatsAppTemplate } from "@/lib/broadcasts/drafts.server";
import { londonWhen, staffTime } from "@/lib/staff-time";
import { textCost } from "@/lib/broadcasts/broadcasts";
import { SENDING_DAYS } from "@/lib/broadcasts/days";
import { GMAIL_DAILY_LIMIT } from "@/lib/email/gmail-connect";
import { chooseDay } from "@/tests/browser/date-picker";
import { navigation } from "@/tests/browser/navigation";
import { EMPTY_MAILING_DOC } from "@/lib/mailings/doc";
import { TEMPLATE_FOOTER } from "@/lib/broadcasts/whatsapp-template";
import { UnrecognizedActionError } from "next/dist/client/components/unrecognized-action-error";
import BroadcastWriter, { templateOption, templateLine, type BroadcastWriterActions } from "./BroadcastWriter";
import ChannelWriter from "./ChannelWriter";
import {
  exampleBroadcastData,
  exampleBroadcastEmail,
  exampleBroadcastText,
  exampleLinkCard,
  examplePictureId,
  examplePlace,
  exampleTemplates,
  exampleTextSender,
  exampleTextWords,
} from "./BroadcastWriter.examples";
import { supportersCopy } from "../supporters/copy";
import { mailingsCopy } from "../mailings/copy";
import { broadcastsCopy } from "@/lib/broadcasts/copy";
import { BroadcastWriterExample } from "./BroadcastWriter.gallery.client";

const { leavePage, toldPage } = vi.hoisted(() => ({ leavePage: vi.fn(), toldPage: vi.fn() }));
vi.mock("@/lib/leave-page.client", () => ({ leavePage }));
// What the writer says at the top of the page, which the signed-in layout shows (RefusalPlace).
vi.mock("../ui/ResultForm", async (original) => ({
  ...(await original<typeof import("../ui/ResultForm")>()),
  useTellPage: () => toldPage,
}));
afterEach(() => {
  leavePage.mockClear();
  toldPage.mockClear();
});

const copy = broadcastsCopy.broadcastPages;
const WAIT = { timeout: 3000 };

function fakeActions() {
  let version = 4;
  const action = (answer: () => unknown) => vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => answer());
  return {
    save: action(() => ({ ok: true, version: ++version })),
    attach: action(() => ({ ok: true, version: ++version, attachments: [] })),
    detach: action(() => ({ ok: true, version: ++version, attachments: [] })),
    sendTest: action(() => ({ ok: true, to: "me@pauseai.uk" })),
    schedule: action(() => ({ ok: true, scheduled: true })),
    deleteDraft: vi.fn(async () => ({ ok: true })),
    changeConsent: action(() => ({ ok: true, version: ++version })),
    create: vi.fn(async () => ({ ok: true })),
    submitTemplate: action(() => ({ ok: true, taken: true })),
    withdrawTemplate: action(() => ({ ok: true })),
    deleteTemplate: action(() => ({ ok: true })),
    linkCard: vi.fn(async (url: string) => ({
      ok: true,
      card: url === "https://pauseai.uk/march" ? exampleLinkCard : null,
    })),
    findPlaces: vi.fn(async () => ({ ok: true, places: [examplePlace] })),
    uploadPicture: action(() => ({ ok: true, pictureId: examplePictureId })),
  };
}

/** What a Server Action throws when a deploy since the page opened has taken it away. */
const gone = () => new UnrecognizedActionError('Server Action "x" was not found on the server.');

/** What a Server Action rejects with when the server threw: a digest, so the site isn't told of it again. */
const thrown = () => Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1" });

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
  const lists = supportersCopy.supporters.filters.lists;
  const LUMA = "email:newsletter:yes email:events:yes";
  // Email or text, one of two lozenges; Said yes to, one of the channel's lists, a lozenge each.
  const group = (name: string) => page.getByRole("radiogroup", { name }).last();
  const radios = (name: string) =>
    [...group(name).element().querySelectorAll<HTMLButtonElement>("button[role=radio]")].map((one) => [
      one.textContent,
      one.getAttribute("aria-checked") === "true",
      one.disabled,
    ]);
  const choose = (within: string, name: string) => group(within).getByRole("radio", { name, exact: true }).click();

  it("asks email or text, then offers that channel's lists in a row, its own chosen, the other channel shut once it has words", async () => {
    await renderWriter();
    expect(radios(copy.consentChannel)).toEqual([
      [copy.channels.email, true, false],
      [copy.channels.text, false, true],
    ]);
    expect(radios(copy.facts.list)).toEqual([
      [lists.updates, true, false],
      [lists["updates-luma"], false, false],
      [lists.volunteering, false, false],
    ]);
    // One list at a time, with what each means beside them.
    expect(page.getByRole("button", { name: staffVocabulary.filters.addChoice }).query()).toBeNull();
    await expect
      .element(
        page.getByRole("button", {
          name: supportersCopy.supporters.detail.permissions.listHelp(lists.volunteering),
        }),
      )
      .toBeVisible();
  });

  it("swaps its list for another, but not for the one it has", async () => {
    const actions = await renderWriter();
    await choose(copy.facts.list, lists.updates);
    await choose(copy.facts.list, lists["updates-luma"]);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledWith(3, LUMA), WAIT);
    expect(actions.changeConsent).toHaveBeenCalledTimes(1);
  });

  it("has none chosen for topics that are no list, as from before the lists, and takes one in their place", async () => {
    const actions = await renderWriter({
      draft: {
        ...exampleBroadcastEmail,
        topics: ["newsletter", "events", "volunteering"],
        filter: {
          list: "supporters",
          params: { contact: ["email:newsletter:yes", "email:events:yes", "email:volunteering:yes"] },
        },
      },
    });
    expect(radios(copy.facts.list).map(([, on]) => on)).toEqual([false, false, false]);
    await choose(copy.facts.list, lists.volunteering);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledWith(3, "email:volunteering:yes"), WAIT);
  });

  it("offers either channel to one with no words of its own, showing the other's lists without changing it", async () => {
    const actions = await renderWriter({ draft: { ...exampleBroadcastEmail, subject: "", body: EMPTY_MAILING_DOC } });
    await choose(copy.consentChannel, copy.channels.text);
    await vi.waitFor(
      () =>
        expect(radios(copy.facts.list).map(([name]) => name)).toEqual([
          lists.updates,
          lists["updates-luma"],
          lists.volunteering,
        ]),
      WAIT,
    );
    expect(radios(copy.facts.list).every(([, checked, disabled]) => !checked && !disabled)).toBe(true);
    expect(actions.changeConsent).not.toHaveBeenCalled();
  });

  it("changes the Consent, whose action brings the page back, so it isn't fetched again", async () => {
    const actions = await renderWriter();
    const refreshes = navigation.refreshes;
    await choose(copy.facts.list, lists["updates-luma"]);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledWith(3, LUMA), WAIT);
    expect(actions.changeConsent).toHaveBeenCalledTimes(1);
    expect(navigation.refreshes).toBe(refreshes);
    expect(toldPage).not.toHaveBeenCalled();
  });

  it("says at the page's top that a draft has gone, or is no longer one, when its Consent can't change, and goes back to its own", async () => {
    const actions = await renderWriter();
    actions.changeConsent.mockResolvedValue({ ok: false, reason: "gone" });
    await choose(copy.facts.list, lists.volunteering);
    await expect.poll(() => toldPage.mock.calls, WAIT).toEqual([[copy.refusals.draft.gone]]);
    await vi.waitFor(() => expect(radios(copy.facts.list).map(([, on]) => on)).toEqual([true, false, false]), WAIT);
    expect(page.getByText(mailingsCopy.mailingPages.saveStates.conflict).query()).toBeNull();
    expect(page.getByText(staffVocabulary.notDone).query()).toBeNull();
  });

  it("says a draft changed elsewhere when its Consent can't change as it has words now, as a save refused for that does", async () => {
    const actions = await renderWriter();
    actions.changeConsent.mockResolvedValue({ ok: false, reason: "conflict" });
    await choose(copy.facts.list, lists.volunteering);
    await expect.element(page.getByText(mailingsCopy.mailingPages.saveStates.conflict), WAIT).toBeVisible();
    await vi.waitFor(() => expect(radios(copy.facts.list).map(([, on]) => on)).toEqual([true, false, false]), WAIT);
    expect(toldPage).not.toHaveBeenCalled();
  });

  it("says under the lists when a Consent's change broke, and goes back to the draft's own", async () => {
    const actions = await renderWriter();
    actions.changeConsent.mockRejectedValueOnce(thrown());
    await choose(copy.facts.list, lists.volunteering);
    await expect.element(page.getByRole("alert").filter({ hasText: staffVocabulary.notDone }), WAIT).toBeVisible();
    await vi.waitFor(() => expect(radios(copy.facts.list).map(([, on]) => on)).toEqual([true, false, false]), WAIT);
    // The next one tried takes it away.
    await choose(copy.facts.list, lists.volunteering);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalledTimes(2), WAIT);
    await expect.element(page.getByText(staffVocabulary.notDone)).not.toBeInTheDocument();
  });

  it("saves what's typed after changing the Consent, at the version the change made", async () => {
    const actions = await renderWriter();
    // As the server does: each change makes a new version, and a save at any other is refused.
    let version = 4;
    actions.changeConsent.mockImplementation(async () => ({ ok: true, version: ++version }));
    actions.save.mockImplementation(async (_id, at) =>
      at === version ? { ok: true, version: ++version } : { ok: false, reason: "conflict" },
    );
    await choose(copy.facts.list, lists["updates-luma"]);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalled(), WAIT);
    await page.getByLabelText(copy.subject).fill("After the change");
    await expect.element(page.getByText(mailingsCopy.mailingPages.savePill.saved), WAIT).toBeInTheDocument();
    expect(page.getByText(mailingsCopy.mailingPages.saveStates.conflict).query()).toBeNull();
  });

  it("saves what's typed while the Consent changes once it has, at the version the change made", async () => {
    const actions = await renderWriter();
    // As Next and the server do: an action waits for the one before it, each change makes a new version, and a
    // save at any other is refused.
    let version = 4;
    let done = () => {};
    let before: Promise<unknown> = Promise.resolve();
    const inTurn = (run: () => unknown) => (before = before.then(run));
    actions.changeConsent.mockImplementation(() =>
      inTurn(() => new Promise((resolve) => (done = () => resolve({ ok: true, version: ++version })))),
    );
    actions.save.mockImplementation((_id, at) =>
      inTurn(() => (at === version ? { ok: true, version: ++version } : { ok: false, reason: "conflict" })),
    );
    await choose(copy.facts.list, lists["updates-luma"]);
    await vi.waitFor(() => expect(actions.changeConsent).toHaveBeenCalled(), WAIT);
    await page.getByLabelText(copy.subject).fill("While it changes");
    // Longer than a change waits to be saved.
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(actions.save).not.toHaveBeenCalled();
    done();
    await vi.waitFor(() => expect(actions.save).toHaveBeenCalledWith(3, 5, { subject: "While it changes" }), WAIT);
    await expect.element(page.getByText(mailingsCopy.mailingPages.savePill.saved), WAIT).toBeInTheDocument();
    expect(page.getByText(mailingsCopy.mailingPages.saveStates.conflict).query()).toBeNull();
  });

  it("shows the list pressed as chosen at once, and Calculating by the title, a spinner in place of the count and Schedule off, till its change is done", async () => {
    let done = () => {};
    const slow = () => new Promise((resolve) => (done = () => resolve({ ok: true, version: 5 })));
    const chosen = () =>
      radios(copy.facts.list)
        .filter(([, on]) => on)
        .map(([name]) => name);
    const calculating = () => page.getByText(mailingsCopy.mailingPages.savePill.calculating).query();
    const count = () => page.getByText(copy.willGet(412, "email")).query();
    const counting = () => page.getByText(copy.counting).query();
    const actions = await renderWriter();
    actions.changeConsent.mockImplementation(slow);
    expect(chosen()).toEqual([lists.updates]);
    expect(calculating()).toBeNull();
    expect(counting()).toBeNull();
    expect(count()).not.toBeNull();
    await expect.element(button(copy.schedule(412, "email"))).toBeEnabled();
    await choose(copy.facts.list, lists.volunteering);
    await vi.waitFor(() => expect(chosen()).toEqual([lists.volunteering]), WAIT);
    await expect.element(page.getByText(mailingsCopy.mailingPages.savePill.calculating)).toBeVisible();
    // Not the count from before, which would mislead, but that it's being worked out.
    expect(count()).toBeNull();
    expect(counting()!.closest("[aria-busy=true]")).not.toBeNull();
    await expect.element(button(copy.schedule(412, "email"))).toBeDisabled();
    // Another press waits for this one.
    await choose(copy.facts.list, lists["updates-luma"]);
    expect(actions.changeConsent).toHaveBeenCalledTimes(1);
    done();
    // The page the action brings back has the draft's new list; here it's still the old, so that shows again.
    await vi.waitFor(() => expect(calculating()).toBeNull(), WAIT);
    expect(chosen()).toEqual([lists.updates]);
    expect(counting()).toBeNull();
    expect(count()!.closest("[aria-busy]")).toBeNull();
    await expect.element(button(copy.schedule(412, "email"))).toBeEnabled();
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
    // The list picked there is chosen at once, the form still greyed, with Calculating, and no call for a Consent.
    let done = () => {};
    actions.changeConsent.mockImplementation(
      () => new Promise((resolve) => (done = () => resolve({ ok: true, version: 5 }))),
    );
    await choose(copy.facts.list, lists["updates-luma"]);
    await vi.waitFor(
      () => expect(actions.changeConsent).toHaveBeenCalledWith(3, "text:newsletter:yes text:events:yes"),
      WAIT,
    );
    expect(radios(copy.facts.list).map(([, on]) => on)).toEqual([false, true, false]);
    await expect.element(page.getByText(mailingsCopy.mailingPages.savePill.calculating)).toBeVisible();
    expect(page.getByText(copy.problems["no-consent"]).query()).toBeNull();
    expect(page.getByText("Who").element().closest("[inert]")).not.toBeNull();
    done();
    await vi.waitFor(
      () => expect(page.getByText(mailingsCopy.mailingPages.savePill.calculating).query()).toBeNull(),
      WAIT,
    );
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
    expect(group(copy.facts.list).query()).toBeNull();
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
    await choose(copy.facts.list, lists.volunteering);
    await vi.waitFor(() => expect(actions.create).toHaveBeenCalledWith("text:volunteering:yes"), WAIT);
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
    // Pending till the action brings the scheduled page back.
    await expect.element(button(copy.schedule(412, "email"))).toHaveAttribute("aria-busy", "true");
  });

  it("keeps the button if scheduling is refused, as the draft changed elsewhere, and says so as a save refused for that does", async () => {
    const actions = fakeActions();
    actions.schedule.mockResolvedValue({ ok: false, reason: "conflict" });
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
    await expect.element(page.getByText(mailingsCopy.mailingPages.saveStates.conflict)).toBeVisible();
    expect(toldPage).not.toHaveBeenCalled();
    // Nothing under the button, as the draft says it.
    expect(page.getByText(copy.submitRefused["not-ready"]).query()).toBeNull();
  });

  it("says at the page's top that a draft has gone, or is no longer one, when it can't be scheduled, and under the button what's wrong that the page hadn't caught up with", async () => {
    const actions = await renderWriter();
    for (const reason of ["gone", "not-draft"]) {
      actions.schedule.mockResolvedValueOnce({ ok: false, reason });
      await button(copy.schedule(412, "email")).click();
      await expect.poll(() => toldPage.mock.calls, WAIT).toEqual([[copy.refusals.draft.gone]]);
      await expect.element(button(copy.schedule(412, "email"))).toBeEnabled();
      toldPage.mockClear();
    }
    expect(page.getByRole("alert").query()).toBeNull();
    actions.schedule.mockResolvedValueOnce({ ok: false, reason: "not-ready" });
    await button(copy.schedule(412, "email")).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.submitRefused["not-ready"]);
    expect(toldPage).not.toHaveBeenCalled();
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
    actions.sendTest.mockResolvedValue({ ok: false, reason: "not-sent" });
    await button(copy.sendTest).click();
    await expect.element(page.getByText(copy.testFailed)).toBeVisible();
    expect(toldPage).not.toHaveBeenCalled();
    await page.getByLabelText(copy.testTo).fill("no address");
    await expect.element(button(copy.sendTest)).toBeDisabled();
  });

  it("says at the page's top that the draft has gone, when a test copy finds it has", async () => {
    const actions = await renderWriter();
    actions.sendTest.mockResolvedValue({ ok: false, reason: "gone" });
    await page.getByLabelText(copy.testTo).fill("me@pauseai.uk");
    await button(copy.sendTest).click();
    await expect.poll(() => toldPage.mock.calls, WAIT).toEqual([[copy.refusals.draft.gone]]);
    await expect.element(page.getByText(copy.testFailed)).toBeVisible();
  });

  it("stops saving when a test finds the site has changed under the page, and says a test that broke didn't go", async () => {
    const actions = await renderWriter();
    actions.sendTest.mockRejectedValueOnce(gone());
    await page.getByLabelText(copy.testTo).fill("me@pauseai.uk");
    await button(copy.sendTest).click();
    await expect.element(page.getByText(mailingsCopy.mailingPages.savePill.outdated)).toBeInTheDocument();
    await expect.element(page.getByText(copy.testFailed)).toBeVisible();
    // One that goes, then one that breaks: it didn't go, whatever the one before it did.
    await button(copy.sendTest).click();
    await expect.element(page.getByText(copy.testSent("me@pauseai.uk"))).toBeVisible();
    actions.sendTest.mockRejectedValueOnce(thrown());
    await button(copy.sendTest).click();
    await expect.element(page.getByText(copy.testFailed)).toBeVisible();
    await expect.element(page.getByText(copy.testSent("me@pauseai.uk"))).not.toBeInTheDocument();
    await expect.element(button(copy.sendTest)).toBeEnabled();
  });

  it("goes from hello@ by Postmark, saying it has no limit", async () => {
    await renderWriter({
      draft: { ...exampleBroadcastEmail, sendBy: "postmark" },
      data: { ...exampleBroadcastData, sender: { byGmail: false, connected: false, remaining: null, daily: null } },
    });
    await expect.element(page.getByLabelText(copy.fromAccount, { exact: false })).toHaveValue("postmark");
    await expect.element(page.getByText(copy.sendBy.postmark)).toBeVisible();
    expect(document.body.textContent).not.toContain(copy.sendBy.notConnected("hello@pauseai.uk"));
  });

  it("goes from hello@ by its Gmail, Postmark beside it, its name fixed, and says what it can send today", async () => {
    await renderWriter();
    const account = page.getByLabelText(copy.fromAccount, { exact: false });
    await expect.element(account).toHaveValue("gmail");
    const options = [...account.element().querySelectorAll("option")].map((o) => [o.textContent, o.disabled]);
    expect(options).toEqual([
      [
        mailingsCopy.mailingPages.fromOption("hello@pauseai.uk", mailingsCopy.mailingPages.sendBy.names.postmark),
        false,
      ],
      [mailingsCopy.mailingPages.fromOption("hello@pauseai.uk", mailingsCopy.mailingPages.sendBy.names.gmail), false],
    ]);
    expect(document.body.textContent).not.toContain(copy.sendBy.postmark);
    // The name isn't a field.
    await expect.element(page.getByRole("textbox", { name: copy.fromName })).not.toBeInTheDocument();
    // Enough left today for all it goes to.
    await expect.element(page.getByText(copy.sendBy.room("hello@pauseai.uk", 1788, 1))).toBeVisible();
    // The test goes the same way.
    await expect.element(page.getByText(copy.testVia.emailGmail("hello@pauseai.uk"))).toBeVisible();
  });

  it("saves another choice of what sends it at once, and asks the page for what that can send", async () => {
    const actions = await renderWriter();
    const refreshes = navigation.refreshes;
    await page.getByLabelText(copy.fromAccount, { exact: false }).selectOptions("postmark");
    await vi.waitFor(() => expect(navigation.refreshes).toBeGreaterThan(refreshes), WAIT);
    expect(actions.save.mock.calls.at(-1)?.[2]).toMatchObject({ sendBy: "postmark" });
  });

  it("says nothing of a Gmail just chosen till the page has checked it, nor that it stops it", async () => {
    await renderWriter({
      draft: { ...exampleBroadcastEmail, sendBy: "postmark" },
      data: { ...exampleBroadcastData, sender: { byGmail: false, connected: false, remaining: null, daily: null } },
    });
    await page.getByLabelText(copy.fromAccount, { exact: false }).selectOptions("gmail");
    await expect.element(page.getByText(copy.sendBy.postmark)).not.toBeInTheDocument();
    const said = document.body.textContent!;
    expect(said).not.toContain(copy.sendBy.notConnected("hello@pauseai.uk"));
    expect(said).not.toContain(copy.testVia.emailGmail("hello@pauseai.uk"));
    expect(said).not.toContain(copy.problems["not-connected"]);
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
    actions.save.mockResolvedValue({ ok: false, reason: "conflict" });
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

  it("says how long it keeps trying, seven days at first, until when, and saves another, which moves with its time", async () => {
    const actions = await renderWriter();
    const when = page.getByRole("region", { name: copy.sections.when });
    const until = (iso: string) => when.getByText(copy.untilWhen(londonWhen(new Date(iso), "short")));
    // Seven days after Thu 12 Nov 2099 at 09:18.
    await expect.element(until("2099-11-19T09:18:00Z")).toBeVisible();
    await when.getByRole("combobox", { name: copy.keepsTryingFor }).selectOptions(copy.finishChoice(720));
    await vi.waitFor(() => expect(actions.save.mock.calls.at(-1)?.[2]).toEqual({ finishMinutes: 720 }), WAIT);
    await expect.element(until("2099-11-12T21:18:00Z")).toBeVisible();
    // Its time moved, half a day after that.
    await when.getByRole("combobox", { name: mailingsCopy.mailingPages.hour }).selectOptions("10");
    await expect.element(until("2099-11-12T22:18:00Z")).toBeVisible();
  });

  it("has no time to keep trying until before it has a time", async () => {
    await renderWriter({ draft: { ...exampleBroadcastEmail, dueAt: null } });
    expect(page.getByRole("combobox", { name: copy.keepsTryingFor }).query()).toBeNull();
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

  // The dropdown, named with the choice made, and choosing in it by a choice's name. Each choice is waited for, as
  // it changes the page beneath: a dropdown opened again before then has its list move under the press, which can
  // land outside it and close it.
  const words = () => page.getByRole("button", { name: new RegExp(`^${copy.templateLabel}: `) });
  const pick = async (name: string) => {
    await words().click();
    await page.getByRole("button", { name, exact: true }).click();
    // A template titles the page; new words open their editor, with its hint.
    const chosen =
      name === copy.newTemplate ? page.getByText(copy.newTemplateHint) : page.getByRole("heading", { name, level: 1 });
    await expect.element(chosen).toBeVisible();
  };
  const [march, manager, , , , thanks] = exampleTemplates.map((one) => one.name);

  it("starts with the templates to choose from, no preview, and greyed", async () => {
    await renderWriter({ draft: exampleBroadcastText });
    await expect.element(words()).toHaveAccessibleName(`${copy.templateLabel}: ${copy.pickTemplate}`);
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
    await words().click();
    const menu = document.getElementById(words().element().getAttribute("popovertarget")!)!;
    expect([...menu.querySelectorAll("button")].map((o) => o.textContent)).toEqual([copy.newTemplate]);
  });

  it("chooses a template from the dropdown, naming it, its words only in the preview", async () => {
    const actions = await renderWriter({ draft: exampleBroadcastText });
    // Each with who made it, when, and what else has it, under its name; or a tag if never used.
    await words().click();
    const said = ({ tag, facts }: ReturnType<typeof templateOption>) => [tag, ...facts!].filter(Boolean).join(" ");
    await expect
      .element(page.getByRole("button", { name: march, exact: true }))
      .toHaveAccessibleDescription(said(templateOption(exampleTemplates[0], exampleTemplates[0].uses)));
    await expect
      .element(page.getByRole("button", { name: manager, exact: true }))
      .toHaveAccessibleDescription(said(templateOption(exampleTemplates[1], exampleTemplates[1].uses)));
    await page.getByRole("button", { name: march, exact: true }).click();
    await expect.element(page.getByRole("heading", { name: march, level: 1 })).toBeVisible();
    await expect.element(words()).toHaveAccessibleName(`${copy.templateLabel}: ${march}`);
    // Under the dropdown too: the last of its two, as the menu's comes first.
    await expect.element(page.getByText(templateLine(exampleTemplates[0])).last()).toBeVisible();
    await vi.waitFor(() => expect(actions.save.mock.calls[0][2]).toMatchObject({ templateId: 1 }), WAIT);
    await pick(exampleTemplates[2].name);
    await expect.element(page.getByRole("heading", { name: "Our next event is on Saturday.", level: 1 })).toBeVisible();
  });

  it("says a template made in WhatsApp Manager was made there", async () => {
    await renderWriter({ draft: exampleBroadcastText });
    await pick(manager);
    await expect.element(page.getByText(templateLine(exampleTemplates[1])).last()).toBeVisible();
    expect(templateLine(exampleTemplates[1])).toContain(copy.templateMadeIn);
  });

  it("gives the chosen template's facts as the dropdown does, on a line, Unused last, and counts drafts but this one", async () => {
    const one = exampleTemplates[0];
    expect(templateLine(one)).toBe(
      ["jo@pauseai.uk", copy.templateFacts.used("2 Nov 2026", 318), copy.templateFacts.drafts(1)].join(" · "),
    );
    expect(templateLine(exampleTemplates[1])).toBe(
      [copy.templateMadeIn, copy.templateFacts.approved("20 Oct 2026"), copy.templateFacts.unused].join(" · "),
    );
    // This draft has it saved, so it's one draft fewer.
    await renderWriter({ draft: onTemplate });
    await expect
      .element(page.getByText(templateLine(one, { ...one.uses, drafts: 0 }), { exact: true }).last())
      .toBeVisible();
  });

  it("gives each template in the dropdown its words and facts: who made it, when last sent, scheduled for or approved, and what has it", () => {
    const [used, manager] = exampleTemplates;
    // Sent, so approved before: only when it was last sent.
    expect(templateOption(used, used.uses)).toEqual({
      facts: ["jo@pauseai.uk", copy.templateFacts.used("2 Nov 2026", 318), copy.templateFacts.drafts(1)],
    });
    // Never sent, but scheduled: when it's scheduled for.
    const scheduled = { ...manager, nextScheduledAt: new Date("2026-11-20T10:00:00Z") };
    expect(templateOption(scheduled, { sent: 0, scheduled: 1, drafts: 0 }).facts).toEqual([
      copy.templateMadeIn,
      copy.templateFacts.scheduled("20 Nov 2026"),
    ]);
    expect(copy.templateFacts.drafts(3)).toBe("In 3 drafts");
    // Never had by anything: a tag, and no facts about its use.
    expect(templateOption(manager, manager.uses)).toEqual({
      tag: copy.templateFacts.unused,
      facts: [copy.templateMadeIn, copy.templateFacts.approved("20 Oct 2026")],
    });
    // Never sent nor scheduled, but in a draft: when it was approved, and no tag.
    expect(templateOption(manager, { sent: 0, scheduled: 0, drafts: 3 }).facts).toEqual([
      copy.templateMadeIn,
      copy.templateFacts.approved("20 Oct 2026"),
      copy.templateFacts.drafts(3),
    ]);
  });

  it("edits a template as new words, under its name numbered, keeping the template", async () => {
    const templates = [...exampleTemplates, { ...exampleTemplates[0], id: 9, name: copy.copyName(march, 2) }];
    const actions = await renderWriter({ draft: exampleBroadcastText, data: { ...exampleBroadcastData, templates } });
    await pick(march);
    await button(copy.editTemplate).click();
    await expect.element(page.getByLabelText(copy.templateName)).toHaveValue(copy.copyName(march, 3));
    await expect.element(page.getByRole("textbox", { name: copy.templateWords })).toMatchTextContent(/march\s+meets/);
    await expect.element(words()).toHaveAccessibleName(`${copy.templateLabel}: ${copy.newTemplate}`);
    await vi.waitFor(
      () =>
        expect(actions.save.mock.calls.at(-1)![2]).toMatchObject({ templateId: null, title: copy.copyName(march, 3) }),
      WAIT,
    );
    expect(actions.deleteTemplate).not.toHaveBeenCalled();
    // The very words of a template already: nothing to approve till they change, and it says so under the button,
    // before the list at the foot.
    await expect.element(button(copy.submitTemplate)).toBeDisabled();
    const why = page.getByRole("listitem").filter({ hasText: copy.problems["same-words"] }).first();
    await expect.element(why).toBeVisible();
    expect(
      button(copy.submitTemplate).element().compareDocumentPosition(why.element()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await page.getByRole("textbox", { name: copy.templateWords }).fill("See you at the march");
    await expect.element(button(copy.submitTemplate)).toBeEnabled();
    expect(page.getByText(copy.problems["same-words"]).query()).toBeNull();
  });

  it("deletes a template nothing else has, quietly, letting this draft's choice go first", async () => {
    const actions = await renderWriter({ draft: exampleBroadcastText });
    // One other broadcasts have can't be deleted.
    await pick(march);
    expect(button(copy.deleteTemplate).query()).toBeNull();
    await pick(thanks);
    const refreshes = navigation.refreshes;
    await button(copy.deleteTemplate).click();
    expect(actions.deleteTemplate).not.toHaveBeenCalled();
    await button(staffVocabulary.deleteItShort).click();
    await vi.waitFor(() => expect(actions.deleteTemplate).toHaveBeenCalledWith(6), WAIT);
    // Saved without it before it went.
    expect(actions.save.mock.calls.at(-1)![2]).toMatchObject({ templateId: null });
    expect(actions.save.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      actions.deleteTemplate.mock.invocationCallOrder[0],
    );
    await vi.waitFor(() => expect(navigation.refreshes).toBeGreaterThan(refreshes), WAIT);
    await expect.element(words()).toHaveAccessibleName(`${copy.templateLabel}: ${copy.pickTemplate}`);
    expect(page.getByRole("alert").query()).toBeNull();
  });

  it("says why a template wasn't deleted", async () => {
    const actions = await renderWriter({ draft: exampleBroadcastText });
    for (const [answer, words] of [
      ["used", copy.deleteRefused.used],
      ["gone", copy.deleteRefused.gone],
      ["failed", copy.deleteRefused.failed],
    ] as const) {
      actions.deleteTemplate.mockResolvedValueOnce({ ok: false, reason: answer });
      await pick(thanks);
      await button(copy.deleteTemplate).click();
      await button(staffVocabulary.deleteItShort).click();
      await expect.element(page.getByRole("alert")).toHaveTextContent(words);
    }
    // The action itself broke.
    actions.deleteTemplate.mockRejectedValueOnce(thrown());
    await pick(thanks);
    await button(copy.deleteTemplate).click();
    await button(staffVocabulary.deleteItShort).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.deleteRefused.failed);
    // The site has changed under the page: the page says so (SiteUpdated), not here.
    actions.deleteTemplate.mockRejectedValueOnce(gone());
    await pick(thanks);
    await button(copy.deleteTemplate).click();
    await button(staffVocabulary.deleteItShort).click();
    await expect.element(page.getByText(mailingsCopy.mailingPages.savePill.outdated)).toBeInTheDocument();
    await expect.element(page.getByText(copy.deleteRefused.failed)).not.toBeInTheDocument();
  });

  it("opens the editor for new words, with a second version for some in place of parts, and WhatsApp's formatting, and keeps them and their name", async () => {
    await renderWriter({ draft: exampleBroadcastText });
    await pick(copy.newTemplate);
    await expect.element(page.getByText(copy.newTemplateHint)).toBeVisible();
    await expect.element(page.getByText(mailingsCopy.mailingEditor.partsHeading)).toBeVisible();
    await expect.element(page.getByRole("button", { name: mailingsCopy.mailingEditor.addOnlyFor })).toBeVisible();
    await expect.element(page.getByRole("button", { name: mailingsCopy.mailingEditor.except })).not.toBeInTheDocument();
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
    await pick(march);
    await pick(copy.newTemplate);
    await expect
      .element(page.getByRole("textbox", { name: copy.templateWords }))
      .toHaveTextContent("See you at the march");
    await expect.element(page.getByLabelText(copy.templateName)).toHaveValue("March day");
    await expect.element(page.getByRole("heading", { name: "March day", level: 1 })).toBeVisible();
  });

  it("shows the card WhatsApp makes for the words' first link, asking about each link once it's typed, and once only", async () => {
    const actions = await renderWriter({ draft: exampleBroadcastText });
    await pick(copy.newTemplate);
    const words = page.getByRole("textbox", { name: copy.templateWords });
    await words.fill("See you there https://pauseai.uk/march");
    await expect.element(page.getByText(exampleLinkCard.title)).toBeVisible();
    await words.fill("No card for https://example.org/none");
    await vi.waitFor(() => expect(actions.linkCard).toHaveBeenCalledWith("https://example.org/none"), WAIT);
    await expect.element(page.getByText(exampleLinkCard.title)).not.toBeInTheDocument();
    await words.fill("Back to https://pauseai.uk/march");
    await expect.element(page.getByText(exampleLinkCard.title)).toBeVisible();
    await words.fill("No link at all");
    await expect.element(page.getByText(exampleLinkCard.title)).not.toBeInTheDocument();
    expect(actions.linkCard).toHaveBeenCalledTimes(2);
  });

  it("warns when the words' first link is to Google Maps, and not when another link comes first", async () => {
    await renderWriter({ draft: exampleBroadcastText });
    await pick(copy.newTemplate);
    const words = page.getByRole("textbox", { name: copy.templateWords });
    await words.fill("Meet here https://maps.app.goo.gl/AbCdEfGh12345");
    await expect.element(page.getByText(copy.mapsFirst)).toBeVisible();
    await words.fill("See https://pauseai.uk/march then meet here https://maps.app.goo.gl/AbCdEfGh12345");
    await expect.element(page.getByText(copy.mapsFirst)).not.toBeInTheDocument();
  });

  it("opens on a draft's new words, titled by them, to send to WhatsApp, or schedule, which sends them too", async () => {
    const actions = await renderWriter({
      draft: { ...exampleBroadcastText, title: "Hi there", body: exampleTextWords },
    });
    await expect.element(page.getByRole("heading", { name: "Hi there", level: 1 })).toBeVisible();
    await expect.element(page.getByText(copy.schedulesForApproval(1))).toBeVisible();
    await expect.element(page.getByText(copy.testVia.textNew)).toBeVisible();
    await expect.element(button(copy.sendTest)).toBeDisabled();
    // Scheduling sends them for approval as it schedules; days off, there's time for that.
    await expect.element(button(copy.schedule(412, "text"))).toBeEnabled();
    expect(page.getByText(copy.approvalSoon).query()).toBeNull();
    // Titled for what's done there with new words.
    const preview = page.getByRole("region", { name: copy.previewNew, exact: false });
    expect(
      button(copy.submitTemplate).element().compareDocumentPosition(button(copy.sendTest).element()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect.element(preview.getByRole("button", { name: copy.submitTemplate })).toBeVisible();
    // Refused here: an alert says why, and the button stays, to be pressed again.
    actions.submitTemplate.mockResolvedValue({ ok: false, reason: "already" });
    await button(copy.submitTemplate).click();
    await vi.waitFor(() => expect(actions.submitTemplate).toHaveBeenCalledWith(4), WAIT);
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.submitRefused.already);
    await expect.element(button(copy.submitTemplate)).toBeEnabled();
    expect(navigation.pushed).toEqual([]);
    // WhatsApp didn't take them: its reason, or that it gave none.
    actions.submitTemplate.mockResolvedValue({ ok: true, taken: false, said: "Invalid parameter" });
    await button(copy.submitTemplate).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.submitFailed("Invalid parameter"));
    actions.submitTemplate.mockResolvedValue({ ok: true, taken: false, said: null });
    await button(copy.submitTemplate).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.submitFailed(null));
    // The site has changed under the page: the page says so (SiteUpdated), not here.
    actions.submitTemplate.mockRejectedValueOnce(gone());
    await button(copy.submitTemplate).click();
    await expect.element(page.getByText(mailingsCopy.mailingPages.savePill.outdated)).toBeInTheDocument();
    await expect.element(page.getByText(copy.submitBroke)).not.toBeInTheDocument();
    await expect.element(button(copy.submitTemplate)).toBeEnabled();
    // The action itself broke.
    actions.submitTemplate.mockRejectedValue(thrown());
    await button(copy.submitTemplate).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.submitBroke);
    await expect.element(button(copy.submitTemplate)).toBeEnabled();
    // Sent: the draft is brought back as sent, at its top, where a strip says so; it goes nowhere else.
    const refreshes = navigation.refreshes;
    window.scrollTo({ top: 400, behavior: "instant" });
    actions.submitTemplate.mockResolvedValue({ ok: true, taken: true });
    await button(copy.submitTemplate).click();
    await vi.waitFor(() => expect(navigation.refreshes).toBe(refreshes + 1), WAIT);
    expect(window.scrollY).toBe(0);
    expect(navigation.pushed).toEqual([]);
    // The button stays pending till the page is back with the words waiting.
    await expect.element(button(copy.submitTemplate)).toHaveAttribute("aria-busy", "true");
    expect(page.getByRole("alert").query()).toBeNull();
  });

  it("warns that WhatsApp may not approve new words before a time less than a day off", async () => {
    const soon = new Date(Date.now() + 6 * 60 * 60 * 1000);
    await renderWriter({ draft: { ...exampleBroadcastText, title: "Hi there", body: exampleTextWords, dueAt: soon } });
    await expect.element(page.getByText(copy.approvalSoon)).toBeVisible();
  });

  it("says why Schedule didn't, when WhatsApp didn't take the words it sent for approval", async () => {
    const actions = await renderWriter({
      draft: { ...exampleBroadcastText, title: "Hi there", body: exampleTextWords },
    });
    actions.schedule.mockResolvedValue({ ok: true, scheduled: false, said: "Bad" });
    await button(copy.schedule(412, "text")).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.submitFailed("Bad"));
    await expect.element(button(copy.schedule(412, "text"))).toBeEnabled();
    actions.schedule.mockResolvedValue({ ok: false, reason: "not-ready" });
    await button(copy.schedule(412, "text")).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent(copy.submitRefused["not-ready"]!);
  });

  it("can't send words for approval before there are any, or while anything but the time stops it", async () => {
    await renderWriter({ draft: exampleBroadcastText });
    await pick(copy.newTemplate);
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
    // Named as it was sent, which names the text too.
    const actions = await renderWriter({
      draft: { ...exampleBroadcastText, title: "Hi there", body: exampleTextWords, template },
    });
    // Who asked, and when, under the dropdown, as an approved template's line is; then its name and words, as sent, each under its label.
    await expect.element(page.getByText(copy.templatePending("jo@pauseai.uk", "19 Oct 2026"))).toBeVisible();
    // And at the top, in amber, as the words are locked till WhatsApp decides.
    await expect
      .element(page.getByText(copy.awaitingApproval("jo@pauseai.uk", staffTime(template.requestedAt))))
      .toBeVisible();
    await expect.element(page.getByText(copy.templateName, { exact: true })).toBeVisible();
    await expect
      .element(
        page.getByRole("region", { name: copy.sections.write, exact: false }).getByText("Hi there", { exact: true }),
      )
      .toBeVisible();
    expect(page.getByRole("textbox", { name: copy.templateWords }).query()).toBeNull();
    expect(button(copy.submitTemplate).query()).toBeNull();
    // It can be scheduled, and isn't said to send them for approval, as WhatsApp has them.
    await expect.element(button(copy.schedule(412, "text"))).toBeEnabled();
    expect(page.getByText(copy.schedulesForApproval(1)).query()).toBeNull();
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
    expect(toldPage).not.toHaveBeenCalled();
    // With none waiting to take back any more, the page's top says so, and the action has brought the page back.
    actions.withdrawTemplate.mockResolvedValue({ ok: false, reason: "gone" });
    const before = navigation.refreshes;
    await button(copy.withdrawTemplate).click();
    await button(copy.withdrawSure).click();
    await expect.poll(() => toldPage.mock.calls, WAIT).toEqual([[copy.refusals.withdraw.gone]]);
    expect(navigation.refreshes).toBe(before);
  });

  it("says under the button when taking the words back broke, and over the draft when the site has changed under the page", async () => {
    const template = { ...exampleTemplates[0], status: "pending" as const, approvedAt: null, name: "Hi there" };
    const actions = await renderWriter({
      draft: { ...exampleBroadcastText, title: "Hi there", body: exampleTextWords, template },
    });
    const refreshes = navigation.refreshes;
    actions.withdrawTemplate.mockRejectedValueOnce(thrown());
    await button(copy.withdrawTemplate).click();
    await button(copy.withdrawSure).click();
    await expect.element(page.getByRole("alert").filter({ hasText: staffVocabulary.notDone }), WAIT).toBeVisible();
    actions.withdrawTemplate.mockRejectedValueOnce(gone());
    // The button's as it was to begin with, to press twice again, which takes what it said away.
    await button(copy.withdrawTemplate).click();
    await button(copy.withdrawSure).click();
    await expect.element(page.getByText(mailingsCopy.mailingPages.savePill.outdated)).toBeInTheDocument();
    await expect.element(page.getByText(staffVocabulary.notDone)).not.toBeInTheDocument();
    expect(navigation.refreshes).toBe(refreshes);
    expect(toldPage).not.toHaveBeenCalled();
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

  it("offers to send words for approval again once they're taken back, the button no longer waiting on the page", async () => {
    const template = { ...exampleTemplates[0], status: "pending" as const, approvedAt: null, name: "Hi there" };
    const actions = fakeActions();
    const writer = (withTemplate: typeof template | null) => (
      <BroadcastWriter
        data={exampleBroadcastData}
        draft={{ ...exampleBroadcastText, title: "Hi there", body: exampleTextWords, template: withTemplate }}
        who={<p>Who</p>}
        actions={actions as unknown as BroadcastWriterActions}
      />
    );
    const screen = await render(writer(null));
    await button(copy.submitTemplate).click();
    // Pending till the page is back with them waiting.
    await expect.element(button(copy.submitTemplate)).toHaveAttribute("aria-busy", "true");
    await screen.rerender(writer(template));
    await button(copy.withdrawTemplate).click();
    await button(copy.withdrawSure).click();
    await vi.waitFor(() => expect(actions.withdrawTemplate).toHaveBeenCalledWith(4), WAIT);
    await screen.rerender(writer(null));
    await expect.element(button(copy.submitTemplate)).toBeEnabled();
    await expect.element(button(copy.submitTemplate)).not.toHaveAttribute("aria-busy", "true");
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

describe("BroadcastWriter, a text's top, buttons and second version", () => {
  const top = copy.textTop;
  const places = copy.placeChooser;
  const editing = mailingsCopy.mailingEditor;
  const newWords = { ...exampleBroadcastText, title: "Hi there", body: exampleTextWords };
  const onTemplate = {
    ...exampleBroadcastText,
    title: exampleTemplates[0].name,
    body: exampleTemplates[0].body,
    template: exampleTemplates[0],
  };
  const WROTE = "wrote:regulate-ai";
  const wrote = copy.conditions.wrote("Regulate AI");
  // A version for those who wrote: its words, and a template WhatsApp has, its status as given.
  const version = (status: WhatsAppTemplate["status"] | null, condition = WROTE) => ({
    condition,
    body: {
      type: "doc" as const,
      content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: "Thanks for writing." }] }],
    },
    templateId: 7,
    header: "location" as const,
    place: examplePlace,
    pictureId: null,
    buttons: [{ text: "Yes" }],
    template: status && { ...exampleTemplates[0], id: 7, status, footer: null },
  });

  const words = () => page.getByRole("button", { name: new RegExp(`^${copy.templateLabel}: `) });
  const pick = async (name: string) => {
    await words().click();
    await page.getByRole("button", { name, exact: true }).click();
  };
  const preview = () => page.getByLabelText(/^4/);
  const kind = (name: string) => page.getByRole("radio", { name });
  const tab = (count: number) => page.getByRole("tab", { name: `${wrote} · ${count}` });
  const editor = () => page.getByRole("textbox", { name: copy.templateWords });
  const saved = (actions: ReturnType<typeof fakeActions>, changes: Record<string, unknown>) =>
    vi.waitFor(
      () => expect(actions.save).toHaveBeenCalledWith(4, expect.any(Number), expect.objectContaining(changes)),
      WAIT,
    );
  // A second version for those who wrote, from the "+ Only for those who…" menu.
  const addVersion = async () => {
    await button(editing.addOnlyFor).click();
    await page.getByRole("menuitem", { name: copy.conditions.wroteGroup }).click();
    await page.getByRole("menuitem", { name: /^Regulate AI/ }).click();
  };

  // An approved template whose words aren't the examples' own, for new words to come to.
  const seeYou: WhatsAppTemplate = {
    ...exampleTemplates[0],
    id: 50,
    name: "See you there",
    body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "See you at the march" }] }] },
  };
  const withSeeYou = { ...exampleBroadcastData, templates: [...exampleBroadcastData.templates, seeYou] };

  it("takes new words changed to an approved template's, its top and buttons too, as that template, not to approve again", async () => {
    const actions = await renderWriter({ draft: newWords, data: withSeeYou });
    await editor().fill("See you at the march");
    await expect.element(words()).toHaveAccessibleName(`${copy.templateLabel}: ${seeYou.name}`);
    await saved(actions, { templateId: seeYou.id, title: seeYou.name });
    expect(button(copy.submitTemplate).query()).toBeNull();
    expect(page.getByText(copy.problems["same-words"]).query()).toBeNull();
  });

  it("takes new words WhatsApp approves while the page is open as its template, its words fixed", async () => {
    const actions = fakeActions() as unknown as BroadcastWriterActions;
    const writer = (template: WhatsAppTemplate, templates: WhatsAppTemplate[]) => (
      <BroadcastWriter
        data={{ ...withSeeYou, templates }}
        draft={{ ...newWords, body: seeYou.body, template }}
        who={<p>Who</p>}
        actions={actions}
      />
    );
    const sentFor = { ...seeYou, id: 51, status: "pending" as const };
    const screen = await render(writer(sentFor, exampleBroadcastData.templates));
    await expect.element(button(copy.withdrawTemplate)).toBeVisible();
    // WhatsApp approves them; the draft says so before the list of approved templates has it, then the list does.
    const approved = { ...sentFor, status: "approved" as const };
    await screen.rerender(writer(approved, exampleBroadcastData.templates));
    await expect.element(words()).toHaveAccessibleName(`${copy.templateLabel}: ${copy.newTemplate}`);
    await screen.rerender(writer(approved, [...exampleBroadcastData.templates, approved]));
    await expect.element(words()).toHaveAccessibleName(`${copy.templateLabel}: ${approved.name}`);
    expect(editor().query()).toBeNull();
    await expect.element(button(copy.editTemplate)).toBeVisible();
  });

  it("takes a second version changed to an approved template's as that template, fixed, till it's edited as new", async () => {
    const actions = await renderWriter({ draft: newWords, data: withSeeYou });
    await addVersion();
    await editor().fill("See you at the march");
    await saved(actions, { textVersion: expect.objectContaining({ templateId: seeYou.id }) });
    await expect.element(page.getByText("See you at the march").first()).toBeVisible();
    expect(editor().query()).toBeNull();
    await expect.element(kind(top.none)).toBeDisabled();
    // A version on an approved template sends nothing more for approval than the text's own words.
    await expect.element(button(copy.submitTemplate)).toBeVisible();
    await button(copy.editTemplate).click();
    await expect.element(editor()).toBeVisible();
    await saved(actions, { textVersion: expect.objectContaining({ templateId: null }) });
  });

  // A pair of approved templates a text went out on: its own, and its second version's, for those who wrote.
  const flyering: WhatsAppTemplate = {
    ...exampleTemplates[0],
    id: 60,
    name: "Flyering",
    body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "We are flyering" }] }] },
    lastUsedAt: null,
    uses: { sent: 0, scheduled: 0, drafts: 0 },
  };
  const flyeringTheirs: WhatsAppTemplate = {
    ...flyering,
    id: 61,
    name: "Flyering, for those who wrote",
    body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Thanks for writing" }] }] },
    buttons: [{ text: "Yes" }],
  };
  const withPair = {
    ...exampleBroadcastData,
    templates: [...exampleBroadcastData.templates, flyering, flyeringTheirs],
    pairs: [
      { own: 60, version: 61, condition: WROTE, title: "We are flyering" },
      { own: 60, version: 61, condition: "event:gone", title: "Flyering for a gone event" },
      // One whose template the page hasn't, as it's no longer approved.
      { own: 60, version: 99, condition: WROTE, title: "Flyering, withdrawn" },
    ],
  };

  it("offers a pair of approved templates as one, marked with who its version is for, and not its templates alone", async () => {
    await renderWriter({ draft: newWords, data: withPair });
    await words().click();
    const pairOption = page.getByRole("button", { name: "We are flyering", exact: true });
    await expect.element(pairOption).toBeVisible();
    await expect.element(pairOption.getByText(wrote)).toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Flyering for a gone event", exact: true }).getByText("event:gone"))
      .toBeVisible();
    expect(page.getByRole("button", { name: "Flyering", exact: true }).query()).toBeNull();
    expect(page.getByRole("button", { name: flyeringTheirs.name, exact: true }).query()).toBeNull();
    expect(page.getByRole("button", { name: "Flyering, withdrawn", exact: true }).query()).toBeNull();
  });

  it("takes both of a pair's templates as the text and its version, and one template alone as the whole text", async () => {
    const actions = await renderWriter({ draft: newWords, data: withPair });
    await pick("We are flyering");
    await saved(actions, {
      templateId: 60,
      title: "We are flyering",
      textVersion: expect.objectContaining({ condition: WROTE, templateId: 61, buttons: [{ text: "Yes" }] }),
    });
    await expect.element(words()).toHaveAccessibleName(`${copy.templateLabel}: We are flyering`);
    await expect.element(page.getByRole("tab").first()).toBeVisible();
    // Its own template is unused, but a pair's isn't deleted from here.
    expect(page.getByRole("button", { name: copy.deleteTemplate }).query()).toBeNull();
    await pick(exampleTemplates[2].name);
    await saved(actions, { templateId: exampleTemplates[2].id, textVersion: null });
    expect(page.getByRole("tab").query()).toBeNull();
  });

  it("tops new words with a map of the place found, and gives them reply buttons, each in the preview", async () => {
    const actions = await renderWriter({ draft: newWords });
    await expect.element(kind(top.none)).toHaveAttribute("aria-checked", "true");
    await kind(top.place).click();
    await saved(actions, { header: "location" });
    await page.getByLabelText(places.find).fill("parliament square");
    await button(places.findButton).click();
    await vi.waitFor(() => expect(actions.findPlaces).toHaveBeenCalledWith("parliament square"), WAIT);
    await expect.element(preview().getByText(examplePlace.address, { exact: true })).toBeVisible();
    await saved(actions, { place: examplePlace });
    await button(copy.replyButtons.addReply).click();
    await page.getByLabelText(copy.replyButtons.words).fill("I'm coming");
    await expect.element(preview().getByRole("listitem").filter({ hasText: "I'm coming" })).toBeVisible();
    await saved(actions, { buttons: [{ text: "I'm coming" }] });
    // Back to no top: no map in the preview, though the place is kept.
    await kind(top.none).click();
    await expect.element(preview().getByText(examplePlace.address, { exact: true })).not.toBeInTheDocument();
  });

  it("finds no place on a page the site has changed under, and says it's outdated", async () => {
    const actions = await renderWriter({ draft: newWords });
    await kind(top.place).click();
    actions.findPlaces.mockRejectedValueOnce(gone());
    await page.getByLabelText(places.find).fill("parliament square");
    await button(places.findButton).click();
    await expect.element(page.getByText(mailingsCopy.mailingPages.savePill.outdated)).toBeInTheDocument();
    await expect.element(page.getByText(places.none)).toBeVisible();
  });

  it("warns of no Google Maps link first in the words when the top is a map", async () => {
    await renderWriter({
      draft: {
        ...newWords,
        body: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Meet https://maps.app.goo.gl/AbCdEfGh12345" }] },
          ],
        },
        header: "location",
        place: examplePlace,
      },
    });
    await expect.element(preview().getByText(examplePlace.address, { exact: true })).toBeVisible();
    expect(page.getByText(copy.mapsFirst).query()).toBeNull();
  });

  it("takes a chosen template's top and buttons, unchangeable, but its place can be found", async () => {
    const templates = exampleTemplates.map((one) =>
      one.id === 3 ? { ...one, header: "location" as const, buttons: [{ text: "Count me in" }] } : one,
    );
    const actions = await renderWriter({ draft: exampleBroadcastText, data: { ...exampleBroadcastData, templates } });
    await pick(templates[2].name);
    await expect.element(kind(top.place)).toHaveAttribute("aria-checked", "true");
    await expect.element(kind(top.place)).toBeDisabled();
    await expect.element(page.getByLabelText(copy.replyButtons.words)).toBeDisabled();
    await expect.element(page.getByLabelText(copy.replyButtons.words)).toHaveValue("Count me in");
    expect(button(copy.replyButtons.addReply).query()).toBeNull();
    await expect.element(preview().getByRole("listitem").filter({ hasText: "Count me in" })).toBeVisible();
    await page.getByLabelText(places.find).fill("parliament square");
    await button(places.findButton).click();
    await expect.element(preview().getByText(examplePlace.address, { exact: true })).toBeVisible();
    await saved(actions, { place: examplePlace });
    // Another template, with neither, takes them away.
    await pick(templates[0].name);
    await expect.element(kind(top.none)).toHaveAttribute("aria-checked", "true");
    expect(page.getByLabelText(copy.replyButtons.words).query()).toBeNull();
  });

  it("offers the link's preview once the words have a link, for the text and its version, each by its own words", async () => {
    await renderWriter({ draft: newWords });
    await expect.element(kind(top.none)).toHaveAttribute("aria-checked", "true");
    await editor().fill("The march: https://pauseai.uk/march");
    await expect.element(kind(top.linkPreview)).toHaveAttribute("aria-checked", "true");
    // The version starts as a copy of the words, link and all; its own words without one have none.
    await addVersion();
    await expect.element(tab(120)).toHaveAttribute("aria-selected", "true");
    await expect.element(kind(top.linkPreview)).toHaveAttribute("aria-checked", "true");
    await editor().fill("Thanks for writing to your MP.");
    await expect.element(kind(top.none)).toHaveAttribute("aria-checked", "true");
    // Everyone else's still has the text's own link.
    await tab(292).click();
    await expect.element(kind(top.linkPreview)).toHaveAttribute("aria-checked", "true");
  });

  it("adds a second version beside new words, a copy of them, its tab open, and one template till it differs", async () => {
    const actions = await renderWriter({ draft: newWords });
    await addVersion();
    await expect.element(tab(120)).toHaveAttribute("aria-selected", "true");
    await expect.element(tab(292)).toHaveAttribute("aria-selected", "false");
    await expect.element(page.getByText(editing.onlyForLabel(wrote))).toBeVisible();
    await expect.element(page.getByText(copy.textVersions.templates(1))).toBeVisible();
    // A text has one at most, so nothing offers another, nor heads the side.
    expect(button(editing.addOnlyFor).query()).toBeNull();
    expect(page.getByText(editing.partsHeading).query()).toBeNull();
    await saved(actions, { textVersion: expect.objectContaining({ condition: WROTE, templateId: null }) });
    await expect.element(button(copy.submitTemplate)).toBeVisible();
    // Its own words: two templates now, both sent for approval.
    await editor().fill("Thanks for writing to your MP.");
    await expect.element(page.getByText(copy.textVersions.templates(2))).toBeVisible();
    await expect.element(button(copy.textVersions.submit(2))).toBeVisible();
    await expect.element(page.getByText(copy.schedulesForApproval(2))).toBeVisible();
    // Its own top and buttons, each making it new words again.
    await kind(top.place).click();
    await page.getByLabelText(places.find).fill("parliament square");
    await button(places.findButton).click();
    await button(copy.replyButtons.addReply).click();
    await page.getByLabelText(copy.replyButtons.words).fill("Done it");
    await saved(actions, {
      textVersion: expect.objectContaining({
        header: "location",
        place: examplePlace,
        buttons: [{ text: "Done it" }],
        templateId: null,
      }),
    });
    // The preview is theirs, for someone who wrote; the toggle shows everyone else's.
    await expect.element(preview().getByText("Thanks for writing to your MP.")).toBeVisible();
    await expect.element(preview().getByText(examplePlace.address, { exact: true })).toBeVisible();
    await expect.element(preview().getByRole("listitem").filter({ hasText: "Done it" })).toBeVisible();
    await preview().getByRole("button", { name: wrote }).click();
    await expect.element(preview().getByText(/Look for the orange flags/)).toBeVisible();
    await expect.element(preview().getByText(examplePlace.address, { exact: true })).not.toBeInTheDocument();
    // Everyone else's tab: the text's own words, top and buttons.
    await tab(292).click();
    await expect.element(page.getByText(editing.exceptLabel(wrote))).toBeVisible();
    await expect.element(editor()).toMatchTextContent(/Look for the orange flags/);
    await expect.element(kind(top.none)).toHaveAttribute("aria-checked", "true");
  });

  it("offers a second version under a chosen template's facts, with no editor to have it beside", async () => {
    await renderWriter({ draft: onTemplate });
    await addVersion();
    // The same words as the template: nothing to send for approval.
    await expect.element(page.getByRole("tab").first()).toBeVisible();
    expect(page.getByText(/^Goes to WhatsApp/).query()).toBeNull();
    expect(button(copy.submitTemplate).query()).toBeNull();
    await editor().fill("Thanks for writing.");
    // Only the version's words go, as the text's own are approved.
    await expect.element(page.getByText(copy.textVersions.templates(1))).toBeVisible();
    await expect.element(button(copy.submitTemplate)).toBeVisible();
    // Everyone else's is the template, whose top is fixed, with no words to write and no buttons.
    await tab(292).click();
    await expect.element(kind(top.none)).toBeDisabled();
    expect(editor().query()).toBeNull();
    expect(page.getByText(copy.replyButtons.heading).query()).toBeNull();
  });

  it("makes the open version the text for everyone with its ×, as new words, the other gone", async () => {
    const actions = await renderWriter({ draft: onTemplate });
    await addVersion();
    await editor().fill("Thanks for writing.");
    await button(editing.forEveryone).click();
    await expect.element(tab(120)).not.toBeInTheDocument();
    await expect.element(words()).toHaveAccessibleName(`${copy.templateLabel}: ${copy.newTemplate}`);
    await expect.element(editor()).toHaveTextContent("Thanks for writing.");
    await saved(actions, { textVersion: null, templateId: null });
    await expect.element(button(editing.addOnlyFor)).toBeVisible();
  });

  it("keeps the text's own words with the × on everyone else's tab", async () => {
    const actions = await renderWriter({ draft: newWords });
    await addVersion();
    await editor().fill("Thanks for writing.");
    await tab(292).click();
    await button(editing.forEveryone).click();
    await expect.element(tab(292)).not.toBeInTheDocument();
    await expect.element(editor()).toMatchTextContent(/Look for the orange flags/);
    await saved(actions, { textVersion: null });
  });

  it("shows a version WhatsApp is reviewing as it was sent, unchangeable, with nothing to send for approval", async () => {
    await renderWriter({ draft: { ...onTemplate, textVersion: version("pending") } });
    await expect.element(tab(120)).toHaveAttribute("aria-selected", "true");
    await expect.element(page.getByText("Thanks for writing.").first()).toBeVisible();
    expect(editor().query()).toBeNull();
    await expect.element(kind(top.place)).toBeDisabled();
    await expect.element(page.getByLabelText(copy.replyButtons.words)).toBeDisabled();
    expect(button(editing.forEveryone).query()).toBeNull();
    expect(button(copy.submitTemplate).query()).toBeNull();
    // Its preview, with the footer it'll go with, can't be tested till WhatsApp approves it.
    await expect.element(preview().getByText(TEMPLATE_FOOTER, { exact: true })).toBeVisible();
    await expect.element(page.getByText(copy.testVia.textNew)).toBeVisible();
  });

  it("previews an approved version as a template, to test, and copes with a condition it has no words for", async () => {
    await renderWriter({ draft: { ...onTemplate, textVersion: version("approved", "gone:yes") } });
    await expect.element(page.getByRole("tab", { name: "gone:yes · 0" })).toBeVisible();
    await expect.element(page.getByRole("tab", { name: "gone:yes · 412" })).toBeVisible();
    await expect.element(preview().getByText(examplePlace.address, { exact: true })).toBeVisible();
    await expect.element(page.getByText(copy.testVia.text("07700 900000"))).toBeVisible();
  });

  it("says why WhatsApp rejected a version's words, till they change", async () => {
    const rejected = {
      ...version("rejected"),
      template: { ...version("rejected").template!, rejectedReason: "INVALID_FORMAT" },
    };
    await renderWriter({ draft: { ...onTemplate, textVersion: rejected } });
    const why = page.getByText(copy.rejected(broadcastsCopy.notifications.templateRejectedWhy.reasons.INVALID_FORMAT!));
    await expect.element(why).toBeVisible();
    await editor().fill("Thanks for writing, again.");
    await expect.element(why).not.toBeInTheDocument();
  });

  it("previews a version whose template is gone, before the text's own words are chosen", async () => {
    await renderWriter({ draft: { ...exampleBroadcastText, textVersion: { ...version(null), header: null } } });
    expect(page.getByText(copy.chooseTemplate).query()).toBeNull();
    await expect.element(preview().getByText("Thanks for writing.")).toBeVisible();
    await expect.element(preview().getByText(TEMPLATE_FOOTER, { exact: true })).toBeVisible();
    await expect.element(preview().getByText(examplePlace.address, { exact: true })).not.toBeInTheDocument();
  });

  it("switches the preview with the version's tabs, and the tabs with the preview's toggle", async () => {
    await renderWriter({ draft: newWords });
    await addVersion();
    await editor().fill("Thanks for writing to your MP.");
    const toggle = () => preview().getByRole("button", { name: wrote });
    await expect.element(toggle()).toHaveAttribute("aria-pressed", "true");
    await expect.element(preview().getByText("Thanks for writing to your MP.")).toBeVisible();
    await tab(292).click();
    await expect.element(toggle()).toHaveAttribute("aria-pressed", "false");
    await expect.element(preview().getByText(/Look for the orange flags/)).toBeVisible();
    await toggle().click();
    await expect.element(tab(120)).toHaveAttribute("aria-selected", "true");
    await expect.element(editor()).toHaveTextContent("Thanks for writing to your MP.");
    await expect.element(preview().getByText("Thanks for writing to your MP.")).toBeVisible();
    await toggle().click();
    await expect.element(tab(292)).toHaveAttribute("aria-selected", "true");
    await expect.element(editor()).toMatchTextContent(/Look for the orange flags/);
  });

  it("keeps the preview's toggle where it was on the screen as it switches the tabs above it", async () => {
    await renderWriter({ draft: newWords });
    await addVersion();
    await editor().fill("Thanks.");
    const toggle = () => preview().getByRole("button", { name: wrote });
    toggle().element().scrollIntoView({ block: "center" });
    const before = toggle().element().getBoundingClientRect().top;
    await toggle().click();
    await expect.element(tab(292)).toHaveAttribute("aria-selected", "true");
    await expect.poll(() => Math.abs(toggle().element().getBoundingClientRect().top - before)).toBeLessThan(2);
  });

  // The bubble's buttons, in the list under it that has the link button.
  const details = () => preview().getByRole("listitem").filter({ hasText: "Details" });
  const underBubble = () => [...details().element().parentElement!.children].map((item) => item.textContent);

  it("shows a text's link buttons in the preview after its reply buttons, as WhatsApp sends them", async () => {
    const buttons = [{ text: "Details", url: "https://pauseai.uk/march" }, { text: "Yes" }, { text: "No" }];
    await renderWriter({ draft: { ...newWords, buttons } });
    await expect.element(details()).toBeVisible();
    expect(underBubble()).toEqual(["Yes", "No", "Details"]);
  });

  it("shows a version's link buttons in the preview after its reply buttons too", async () => {
    const buttons = [{ text: "Details", url: "https://pauseai.uk/march" }, { text: "Yes" }];
    await renderWriter({ draft: { ...onTemplate, textVersion: { ...version("pending"), buttons } } });
    await expect.element(details()).toBeVisible();
    expect(underBubble()).toEqual(["Yes", "Details"]);
  });
});

describe("BroadcastWriter, a text's picture", () => {
  const top = copy.textTop;
  const pictures = copy.pictureChooser;
  const newWords = { ...exampleBroadcastText, title: "Hi there", body: exampleTextWords };
  const onTemplate = {
    ...exampleBroadcastText,
    title: exampleTemplates[0].name,
    body: exampleTemplates[0].body,
    template: exampleTemplates[0],
  };
  const WROTE = "wrote:regulate-ai";
  const wrote = copy.conditions.wrote("Regulate AI");
  const shown = examplePictureId;

  const preview = () => page.getByLabelText(/^4/);
  const kind = (name: string) => page.getByRole("radio", { name });
  const tab = (count: number) => page.getByRole("tab", { name: `${wrote} · ${count}` });
  const saved = (actions: ReturnType<typeof fakeActions>, changes: Record<string, unknown>) =>
    vi.waitFor(
      () => expect(actions.save).toHaveBeenCalledWith(4, expect.any(Number), expect.objectContaining(changes)),
      WAIT,
    );
  /** The picture at the top of the preview's bubble, if it has one. */
  const previewPicture = () => preview().element().querySelector<HTMLImageElement>('img[src^="data:image/png"]');
  const png = (name = "march.png") => new File(["x"], name, { type: "image/png" });
  /** Chooses `file` in the picture box's file picker. */
  const choose = (file: File) => {
    const picker = document.querySelector<HTMLInputElement>('input[type=file][accept="image/jpeg,image/png"]')!;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    picker.files = transfer.files;
    picker.dispatchEvent(new Event("change", { bubbles: true }));
  };
  /** Pastes `files`, or words if there are none, on `on`; says whether the page took the paste as its own. */
  const paste = (on: Element, ...files: File[]) => {
    const data = new DataTransfer();
    if (files.length) for (const file of files) data.items.add(file);
    else data.setData("text/plain", "Some words");
    const event = new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true });
    on.dispatchEvent(event);
    return event.defaultPrevented;
  };
  /** The file each upload sent. */
  const uploaded = (actions: ReturnType<typeof fakeActions>) =>
    actions.uploadPicture.mock.calls.map(([form]) => ((form as FormData).get("file") as File).name);
  const pause = () => new Promise((resolve) => setTimeout(resolve, 100));
  const addVersion = async () => {
    await button(mailingsCopy.mailingEditor.addOnlyFor).click();
    await page.getByRole("menuitem", { name: copy.conditions.wroteGroup }).click();
    await page.getByRole("menuitem", { name: /^Regulate AI/ }).click();
  };

  it("says a missing picture for new words once, under Send for approval, not again by Schedule", async () => {
    const missing = () => page.getByText(copy.problems["no-picture"]);
    await renderWriter({ draft: { ...newWords, header: "image" } });
    await expect.element(preview().getByText(copy.problems["no-picture"])).toBeVisible();
    expect(missing().all()).toHaveLength(1);
    // Schedule says once to fix it there.
    await expect.element(page.getByText(copy.problems["fix-preview"])).toBeVisible();
  });

  it("says a missing picture for a chosen template by Schedule, as there's nothing to send for approval", async () => {
    const missing = () => page.getByText(copy.problems["no-picture"]);
    await renderWriter({
      draft: { ...onTemplate, header: "image", template: { ...exampleTemplates[0], header: "image" } },
    });
    await expect.element(missing()).toBeVisible();
    expect(missing().all()).toHaveLength(1);
    expect(preview().getByText(copy.problems["no-picture"]).query()).toBeNull();
    expect(page.getByText(copy.problems["fix-preview"]).query()).toBeNull();
  });

  it("tops new words with a picture chosen, in the preview once it's kept", async () => {
    const actions = await renderWriter({ draft: newWords });
    await kind(top.picture).click();
    await saved(actions, { header: "image" });
    // No picture yet, so none in the preview.
    await expect.element(page.getByText(pictures.drop)).toBeVisible();
    expect(previewPicture()).toBeNull();
    choose(png());
    await saved(actions, { pictureId: examplePictureId });
    expect(uploaded(actions)).toEqual(["march.png"]);
    await expect.poll(() => previewPicture()?.getAttribute("src")).toBe(shown);
    await expect.element(page.getByRole("img", { name: pictures.shown })).toHaveAttribute("src", shown);
  });

  it("says why a picture chosen won't do, and takes none on a page the site has changed under", async () => {
    const actions = await renderWriter({ draft: { ...newWords, header: "image" } });
    actions.uploadPicture.mockResolvedValueOnce({ ok: false, reason: "too-big" });
    choose(png("huge.png"));
    await expect.element(page.getByText(pictures.refusals["too-big"])).toBeVisible();
    actions.uploadPicture.mockRejectedValueOnce(gone());
    choose(png());
    await expect.element(page.getByText(mailingsCopy.mailingPages.savePill.outdated)).toBeInTheDocument();
    expect(previewPicture()).toBeNull();
    expect(page.getByText(pictures.refusals["too-big"]).query()).toBeNull();
  });

  it("makes a picture pasted anywhere in Write the text's top, but leaves words and other files pasted alone", async () => {
    const actions = await renderWriter({ draft: newWords });
    const name = page.getByLabelText(copy.templateName).element();
    expect(paste(name)).toBe(false);
    expect(paste(name, new File(["x"], "notes.txt", { type: "text/plain" }))).toBe(false);
    await pause();
    expect(actions.uploadPicture).not.toHaveBeenCalled();
    expect(paste(name, new File(["x"], "notes.txt", { type: "text/plain" }), png())).toBe(true);
    await saved(actions, { header: "image", pictureId: examplePictureId });
    expect(uploaded(actions)).toEqual(["march.png"]);
    await expect.element(kind(top.picture)).toHaveAttribute("aria-checked", "true");
    await expect.poll(() => previewPicture()?.getAttribute("src")).toBe(shown);
  });

  it("keeps no picture pasted that WhatsApp won't take, or on a page the site has changed under", async () => {
    const actions = await renderWriter({ draft: newWords });
    const name = page.getByLabelText(copy.templateName).element();
    actions.uploadPicture.mockResolvedValueOnce({ ok: false, reason: "not-picture" });
    paste(name, png());
    await vi.waitFor(() => expect(actions.uploadPicture).toHaveBeenCalledTimes(1), WAIT);
    actions.uploadPicture.mockRejectedValueOnce(gone());
    paste(name, png());
    await expect.element(page.getByText(mailingsCopy.mailingPages.savePill.outdated)).toBeInTheDocument();
    await expect.element(kind(top.none)).toHaveAttribute("aria-checked", "true");
    expect(previewPicture()).toBeNull();
  });

  it("pastes no picture where a chosen template's top is another kind", async () => {
    const actions = await renderWriter({ draft: onTemplate });
    expect(paste(kind(top.none).element(), png())).toBe(true);
    await pause();
    expect(actions.uploadPicture).not.toHaveBeenCalled();
  });

  it("pastes a picture where a chosen template's top is one, as each send gives it", async () => {
    const templates = exampleTemplates.map((one, i) => (i === 0 ? { ...one, header: "image" as const } : one));
    const actions = await renderWriter({
      draft: { ...onTemplate, template: templates[0], header: "image" },
      data: { ...exampleBroadcastData, templates },
    });
    await expect.element(kind(top.picture)).toBeDisabled();
    paste(kind(top.picture).element(), png());
    await saved(actions, { header: "image", pictureId: examplePictureId });
    await expect.poll(() => previewPicture()?.getAttribute("src")).toBe(shown);
  });

  it("pastes no picture where WhatsApp is reviewing new words", async () => {
    const template = { ...exampleTemplates[0], status: "pending" as const, approvedAt: null, name: "Hi there" };
    const actions = await renderWriter({ draft: { ...newWords, template } });
    paste(kind(top.none).element(), png());
    await pause();
    expect(actions.uploadPicture).not.toHaveBeenCalled();
  });

  it("pastes a picture as the open version's top, making it new words, and on everyone else's tab as theirs", async () => {
    const actions = await renderWriter({ draft: newWords });
    await addVersion();
    await expect.element(tab(120)).toHaveAttribute("aria-selected", "true");
    paste(kind(top.none).element(), png());
    await saved(actions, {
      textVersion: expect.objectContaining({
        condition: WROTE,
        header: "image",
        pictureId: examplePictureId,
        templateId: null,
      }),
    });
    await expect.poll(() => previewPicture()?.getAttribute("src")).toBe(shown);
    await tab(292).click();
    await expect.poll(() => previewPicture()).toBeNull();
    paste(kind(top.none).element(), png("theirs.png"));
    await saved(actions, { header: "image", pictureId: examplePictureId });
    await expect.element(kind(top.picture)).toHaveAttribute("aria-checked", "true");
    expect(uploaded(actions)).toEqual(["march.png", "theirs.png"]);
  });

  it("pastes a picture on a version whose approved template's top is one, keeping it that template", async () => {
    const theirs = { ...exampleTemplates[0], id: 70, header: "image" as const };
    const version = {
      condition: WROTE,
      body: exampleTextWords,
      templateId: 70,
      header: "image" as const,
      place: null,
      pictureId: null,
      buttons: [],
      template: theirs,
    };
    const actions = await renderWriter({
      draft: { ...onTemplate, textVersion: version },
      data: { ...exampleBroadcastData, templates: [...exampleTemplates, theirs] },
    });
    await expect.element(kind(top.picture)).toBeDisabled();
    paste(kind(top.picture).element(), png());
    await saved(actions, { textVersion: expect.objectContaining({ templateId: 70, pictureId: examplePictureId }) });
  });

  it("pastes no picture on a version WhatsApp is reviewing", async () => {
    const version = {
      condition: WROTE,
      body: exampleTextWords,
      templateId: 7,
      header: "image" as const,
      place: null,
      pictureId: examplePictureId,
      buttons: [],
      template: { ...exampleTemplates[0], id: 7, status: "pending" as const, footer: null },
    };
    const actions = await renderWriter({ draft: { ...onTemplate, textVersion: version } });
    await expect.poll(() => previewPicture()?.getAttribute("src")).toBe(shown);
    paste(kind(top.picture).element(), png());
    await pause();
    expect(actions.uploadPicture).not.toHaveBeenCalled();
  });

  it("previews a version's picture top only once it has a picture", async () => {
    const version = {
      condition: WROTE,
      body: exampleTextWords,
      templateId: null,
      header: "image" as const,
      place: null,
      pictureId: null,
      buttons: [],
      template: null,
    };
    await renderWriter({ draft: { ...newWords, textVersion: version } });
    await expect.element(page.getByText(pictures.drop)).toBeVisible();
    expect(previewPicture()).toBeNull();
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
