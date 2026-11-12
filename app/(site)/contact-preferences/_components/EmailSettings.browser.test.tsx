import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { emailSettingsCopy as copy } from "@/lib/content/email-settings";
import type { SettingsView } from "@/lib/email-settings";
import EmailSettings, { type SettingsActions } from "./EmailSettings";
import {
  exampleBlocked,
  exampleDoNotEmail,
  exampleNoBulk,
  exampleNumberHolds,
  exampleSettings,
  exampleStopped,
  exampleUnsubscribed,
  exampleVolunteer,
} from "./EmailSettings.examples";
import SettingsStart from "./SettingsStart";

const fields = (form: FormData) => [...form.entries()];

/** Actions that each give `next`, and record their forms. */
function actions(next: SettingsView | null = exampleSettings) {
  return {
    save: vi.fn<SettingsActions["save"]>(async () => next),
    lift: vi.fn<SettingsActions["lift"]>(async () => next),
    stopAll: vi.fn<SettingsActions["stopAll"]>(async () => next),
    unsubscribe: vi.fn<SettingsActions["unsubscribe"]>(async () => ({ done: true, view: next })),
    resend: vi.fn<SettingsActions["resend"]>(async () => {}),
  } satisfies SettingsActions;
}

async function show(
  view: SettingsView | null,
  unsubscribe: ("newsletter" | "events")[] | null = null,
  done = actions(),
) {
  await render(
    <EmailSettings
      opened={{ kind: unsubscribe ? "copy" : "link", token: "tok" }}
      unsubscribe={unsubscribe}
      initial={view}
      actions={done}
    />,
  );
  return done;
}

const card = (topic: "newsletter" | "events" | "volunteering") =>
  page.getByRole("group", { name: copy.topics[topic], exact: false });

/** A topic's why: its bubble's, for a phone, first; then as a wide screen shows it under its boxes. */
const whys = (topic: "newsletter" | "events" | "volunteering", reason: string) =>
  card(topic).getByText(`${copy.why.yes} ${reason}`);
const why = (topic: "newsletter" | "events" | "volunteering", reason: string) => whys(topic, reason).last();

const wide = () => page.viewport(1280, 800);
const phone = () => page.viewport(390, 800);

beforeEach(wide);

describe("EmailSettings", () => {
  it("shows each topic with its boxes, what it is, and why, and the address alone", async () => {
    await show(exampleSettings);
    await expect.element(page.getByRole("heading", { level: 1, name: copy.settings.title })).toBeVisible();
    await expect.element(page.getByText(exampleSettings.address)).toBeVisible();
    await expect.element(card("newsletter").getByRole("checkbox", { name: copy.ways.email })).toBeChecked();
    await expect.element(card("newsletter").getByRole("checkbox", { name: copy.ways.text })).toBeChecked();
    await expect.element(card("events").getByRole("checkbox", { name: copy.ways.text })).not.toBeChecked();
    await expect.element(card("volunteering").getByRole("checkbox", { name: copy.ways.call })).toBeVisible();
    await expect.element(card("events").getByText(copy.about.events)).toBeVisible();
    // Why, always under the boxes on a wide screen; that they never asked, where there's no answer.
    await expect.element(why("newsletter", copy.why.reasons.asked!(copy.sourceWords("march-2026-11")))).toBeVisible();
    await expect.element(why("volunteering", copy.why.unasked)).toBeVisible();
    await expect
      .element(card("newsletter").getByRole("button", { name: copy.why.ask, includeHidden: true }))
      .not.toBeVisible();
    // Its numbers aren't named, as the link doesn't prove they're theirs.
    await expect.element(page.getByText("07700 900123", { exact: false })).not.toBeInTheDocument();
    // PauseAI Global's emails open, with how to stop them all.
    await expect.element(page.getByText(copy.global.stopAll, { exact: false }).first()).toBeVisible();
  });

  it("on a phone, gives why in a bubble its “?” opens, and folds PauseAI Global's emails", async () => {
    await show(exampleSettings);
    await phone();
    const reason = copy.why.reasons.asked!(copy.sourceWords("march-2026-11"));
    await expect.element(why("newsletter", reason)).not.toBeVisible();
    await card("newsletter").getByRole("button", { name: copy.why.ask }).click();
    await expect.element(whys("newsletter", reason).first()).toBeVisible();
    await expect.element(page.getByText(copy.global.intro).first()).not.toBeVisible();
    await page.getByText(copy.global.title).last().click();
    await expect.element(page.getByText(copy.global.intro).last()).toBeVisible();
  });

  it("saves each box as it's changed, with whose page it is, and says so under its topic", async () => {
    const done = await show(exampleSettings);
    // Slow to answer, so it says it's saving meanwhile.
    let answer = () => {};
    done.save.mockImplementationOnce(() => new Promise((resolve) => (answer = () => resolve(exampleSettings))));
    await card("volunteering").getByRole("checkbox", { name: copy.ways.email }).click();
    await expect.element(card("volunteering").getByRole("status")).toHaveTextContent(copy.settings.saving);
    answer();
    await expect.element(card("volunteering").getByRole("status")).toHaveTextContent(copy.settings.saved);
    expect(fields(done.save.mock.calls[0][0])).toEqual([
      ["kind", "link"],
      ["token", "tok"],
      ["choice", "newsletter:email"],
      ["choice", "newsletter:text"],
      ["choice", "events:email"],
      ["choice", "volunteering:email"],
    ]);
    // The next change saves too, with the first kept, and says so under its own topic.
    await card("newsletter").getByRole("checkbox", { name: copy.ways.text }).click();
    await vi.waitFor(() => expect(done.save).toHaveBeenCalledTimes(2));
    expect(fields(done.save.mock.calls[1][0])).not.toContainEqual(["choice", "newsletter:text"]);
    expect(fields(done.save.mock.calls[1][0])).toContainEqual(["choice", "volunteering:email"]);
    await expect.element(card("newsletter").getByRole("status")).toHaveTextContent(copy.settings.saved);
    await expect.element(card("volunteering").getByText(copy.settings.saved)).not.toBeInTheDocument();
    // Saved only once every save is: a change made while another saves says Saving till both are.
    let first = () => {};
    done.save.mockImplementationOnce(() => new Promise((resolve) => (first = () => resolve(exampleSettings))));
    await card("events").getByRole("checkbox", { name: copy.ways.text }).click();
    await card("events").getByRole("checkbox", { name: copy.ways.email }).click();
    first();
    await vi.waitFor(() => expect(done.save).toHaveBeenCalledTimes(4));
    await expect.element(card("events").getByRole("status")).toHaveTextContent(copy.settings.saved);
    await expect.element(card("volunteering").getByRole("checkbox", { name: copy.ways.email })).toBeChecked();
  });

  it("says a yes from PauseAI Global's volunteering list was given on joining", async () => {
    await show(exampleVolunteer);
    await expect.element(why("volunteering", copy.why.reasons.volunteered!(""))).toBeVisible();
  });

  it("stops everything", async () => {
    const done = await show(exampleSettings, null, actions(exampleStopped));
    await page.getByRole("button", { name: copy.stopAll.button }).click();
    await expect.element(page.getByRole("heading", { name: copy.stopped.title })).toHaveFocus();
    await expect.element(page.getByRole("button", { name: copy.stopped.button })).toBeVisible();
    expect(fields(done.stopAll.mock.calls[0][0])).toEqual([
      ["kind", "link"],
      ["token", "tok"],
    ]);
  });

  it("holds email under “No bulk emails”, which they can lift, and offers no Stop everything", async () => {
    const done = await show(exampleNoBulk, null, actions(exampleSettings));
    await expect.element(page.getByText(copy.noBulk.body)).toBeVisible();
    await expect.element(page.getByRole("heading", { name: copy.noBulk.title })).not.toHaveFocus();
    await expect.element(card("newsletter").getByRole("checkbox", { name: copy.ways.email })).toBeDisabled();
    await expect.element(card("newsletter").getByRole("checkbox", { name: copy.ways.text })).toBeEnabled();
    await expect.element(page.getByRole("button", { name: copy.stopAll.button })).not.toBeInTheDocument();
    await expect.element(page.getByText(copy.global.stopAll, { exact: false })).not.toBeInTheDocument();
    await page.getByRole("button", { name: copy.noBulk.button }).click();
    await expect.element(page.getByRole("heading", { name: copy.noBulk.title })).not.toBeInTheDocument();
    await expect.element(page.getByRole("heading", { level: 1, name: copy.settings.title })).toHaveFocus();
    expect(done.lift).toHaveBeenCalledOnce();
  });

  it("says what holds it when only PauseAI Global can lift it, and how to contact them", async () => {
    await show(exampleDoNotEmail);
    await expect.element(page.getByRole("heading", { name: copy.doNotEmail.title })).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.noBulk.button })).not.toBeInTheDocument();
    await expect
      .element(page.getByRole("link", { name: copy.onlyGlobal.link }))
      .toHaveAttribute("href", copy.onlyGlobal.url);
    await expect.element(page.getByText(copy.numbersStill, { exact: false })).toBeVisible();
    await expect
      .element(why("newsletter", copy.why.reasons["signed-up"]!(copy.sourceWords("paper-signup"))))
      .toBeVisible();
  });

  it("says an address is blocked, and how to ask us to lift it", async () => {
    await show(exampleBlocked);
    await expect.element(page.getByRole("heading", { name: copy.blocked.title })).toBeVisible();
    await expect
      .element(page.getByRole("link", { name: "hello@pauseai.uk" }))
      .toHaveAttribute("href", "mailto:hello@pauseai.uk");
    // Texts and calls go unmentioned for someone without a number.
    await expect.element(page.getByText(copy.numbersStill, { exact: false })).not.toBeInTheDocument();
    await show({ ...exampleBlocked, numbers: ["+447700900123"] });
    await expect.element(page.getByText(copy.numbersStill, { exact: false })).toBeVisible();
  });

  it("locks texts and calls where PauseAI Global stops them to every number, and says so", async () => {
    // Both, in one box.
    await show(exampleNumberHolds);
    await expect.element(page.getByRole("heading", { name: copy.doNotTextOrCall.title })).toBeVisible();
    await expect.element(page.getByRole("heading", { name: copy.doNotText.title })).not.toBeInTheDocument();
    await expect.element(card("volunteering").getByRole("checkbox", { name: copy.ways.text })).toBeDisabled();
    await expect.element(card("volunteering").getByRole("checkbox", { name: copy.ways.call })).toBeDisabled();
    await expect.element(card("volunteering").getByRole("checkbox", { name: copy.ways.email })).toBeEnabled();
    // Each alone.
    const [email, text, call] = exampleNumberHolds.answers;
    await show({ ...exampleNumberHolds, answers: [email, text] });
    await expect.element(page.getByRole("heading", { name: copy.doNotText.title })).toBeVisible();
    await show({ ...exampleNumberHolds, answers: [email, call] });
    await expect.element(page.getByRole("heading", { name: copy.doNotCall.title })).toBeVisible();
  });

  it("from an email's link: its button first, then what it did, and that the rest is below", async () => {
    const done = await show(exampleSettings, ["newsletter"], actions(exampleUnsubscribed));
    await expect
      .element(page.getByRole("heading", { name: copy.unsubscribe.title(copy.inSentence.newsletter) }))
      .toBeVisible();
    await page.getByRole("button", { name: copy.unsubscribe.button }).click();
    await expect
      .element(page.getByRole("heading", { name: copy.unsubscribe.done(copy.inSentence.newsletter) }))
      .toHaveFocus();
    await expect.element(page.getByText(`${copy.unsubscribe.doneBody} ${copy.unsubscribe.below}`)).toBeVisible();
    expect(fields(done.unsubscribe.mock.calls[0][0])).toEqual([
      ["kind", "copy"],
      ["token", "tok"],
    ]);
    await expect.element(why("newsletter", copy.why.reasons.unsubscribed!(copy.sourceWords("link")))).toBeVisible();
  });

  it("from an email's link to what they don't get already, for whatever reason: that they're not subscribed", async () => {
    await show(exampleUnsubscribed, ["newsletter"]);
    await expect
      .element(page.getByRole("heading", { name: copy.unsubscribe.off(copy.inSentence.newsletter) }))
      .not.toHaveFocus();
    await expect.element(page.getByText(copy.unsubscribe.offBelow)).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.unsubscribe.button })).not.toBeInTheDocument();
  });

  it("from an email's link with a topic they still get: its button", async () => {
    await show(exampleUnsubscribed, ["newsletter", "events"]);
    await expect.element(page.getByRole("button", { name: copy.unsubscribe.button })).toBeVisible();
  });

  it("from an old email's link: its button still, a fresh link for the rest", async () => {
    const done = await show(null, ["newsletter", "events"], actions(null));
    await expect
      .element(
        page.getByRole("heading", {
          name: copy.unsubscribe.title(
            `${copy.inSentence.newsletter} ${copy.unsubscribe.and} ${copy.inSentence.events}`,
          ),
        }),
      )
      .toBeVisible();
    await expect.element(page.getByRole("heading", { name: copy.pageExpired })).toBeVisible();
    await page.getByRole("button", { name: copy.unsubscribe.button }).click();
    await expect.element(page.getByText(copy.unsubscribe.doneBody)).toBeVisible();
    await page.getByRole("button", { name: copy.expired.button }).click();
    await expect.element(page.getByText(copy.expired.sent)).toHaveFocus();
    expect(done.resend).toHaveBeenCalledOnce();
  });

  it("offers a fresh link for a link asked for that's run out", async () => {
    await show(null);
    await expect.element(page.getByRole("heading", { name: copy.expired.title })).toBeVisible();
    await expect.element(page.getByText(copy.expired.body)).toBeVisible();
  });

  it("explains a no by its words, or as never asked where it has none, and a yes it has no words for by nothing", async () => {
    await show({
      ...exampleSettings,
      numbers: [],
      answers: [
        { ...exampleSettings.answers[0], send: "no", reason: "declined" },
        { ...exampleSettings.answers[0], topic: "events", send: "no", reason: "not-opted-in", source: "civicrm" },
        { ...exampleSettings.answers[0], topic: "volunteering", send: "yes", reason: "left", source: "nowhere" },
      ],
    });
    await expect
      .element(why("newsletter", copy.why.reasons.declined!(copy.sourceWords("march-2026-11"))))
      .toBeVisible();
    await expect.element(why("events", copy.why.unasked)).toBeVisible();
    // A yes the page has no words for: no why, and nothing to open on a phone.
    await expect.element(card("volunteering").getByText(copy.why.yes)).not.toBeInTheDocument();
    await expect.element(card("volunteering").getByRole("button", { name: copy.why.ask })).not.toBeInTheDocument();
  });
});

describe("SettingsStart", () => {
  it("asks for an address, then says a link is on its way if we have it", async () => {
    const ask = vi.fn(async (form: FormData) => ({ sent: String(form.get("email")) }));
    await render(<SettingsStart ask={ask} days={7} />);
    await page.getByRole("textbox", { name: copy.start.label }).fill("jane.smith@example.com");
    await page.getByRole("button", { name: copy.start.button }).click();
    await expect.element(page.getByText(copy.sent.body("jane.smith@example.com", 7))).toBeVisible();
    await expect.element(page.getByRole("heading", { level: 1, name: copy.sent.title })).toHaveFocus();
  });

  it("says why it couldn't, and waits for Turnstile before it can send", async () => {
    const ask = vi.fn(async () => ({ message: "Please wait for the spam check" }));
    await render(<SettingsStart ask={ask} days={7} />);
    await page.getByRole("textbox", { name: copy.start.label }).fill("jane.smith@example.com");
    await page.getByRole("button", { name: copy.start.button }).click();
    await expect.element(page.getByRole("alert")).toHaveTextContent("Please wait for the spam check");
    await render(<SettingsStart ask={ask} days={7} turnstileSiteKey="site" />);
    await expect.element(page.getByRole("button", { name: copy.start.button }).last()).toBeDisabled();
  });
});
