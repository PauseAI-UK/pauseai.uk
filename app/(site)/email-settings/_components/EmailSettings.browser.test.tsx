import { describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { emailSettingsCopy as copy, settingsDate } from "@/lib/content/email-settings";
import type { SettingsView } from "@/lib/email-settings";
import EmailSettings, { type SettingsActions } from "./EmailSettings";
import {
  exampleBlocked,
  exampleDoNotEmail,
  exampleNoBulk,
  exampleSettings,
  exampleUnsubscribed,
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

describe("EmailSettings", () => {
  it("shows each topic with its boxes, whether they get it, and why", async () => {
    await show(exampleSettings);
    await expect.element(page.getByRole("heading", { level: 1, name: copy.settings.title })).toBeVisible();
    await expect.element(card("newsletter").getByRole("checkbox", { name: copy.ways.email })).toBeChecked();
    await expect.element(card("newsletter").getByRole("checkbox", { name: copy.ways.text })).toBeChecked();
    await expect.element(card("events").getByRole("checkbox", { name: copy.ways.text })).not.toBeChecked();
    await expect.element(card("volunteering").getByRole("checkbox", { name: copy.ways.call })).toBeVisible();
    await expect.element(card("newsletter").getByText(copy.tags.on)).toBeVisible();
    await expect.element(card("volunteering").getByText(copy.tags.off)).toBeVisible();
    await expect
      .element(
        card("newsletter").getByText(`${copy.why.yes} ${copy.why.reasons.asked!(copy.sourceWords("march-2026-11"))}`),
      )
      .toBeVisible();
    await expect.element(card("volunteering").getByText(copy.why.nothing)).toBeVisible();
    await expect.element(page.getByText(copy.numbers("07700 900123"))).toBeVisible();
    await expect.element(page.getByRole("heading", { name: copy.global.title })).toBeVisible();
  });

  it("saves what's ticked, with whose page it is, and says so", async () => {
    const done = await show(exampleSettings);
    await card("volunteering").getByRole("checkbox", { name: copy.ways.email }).click();
    await card("newsletter").getByRole("checkbox", { name: copy.ways.text }).click();
    const save = page.getByRole("button", { name: copy.settings.save });
    await save.click();
    await expect.element(page.getByText(copy.settings.saved)).toBeVisible();
    // The button stays where the focus was, so the keyboard carries on from it.
    await expect.element(save).toHaveFocus();
    expect(fields(done.save.mock.calls[0][0])).toEqual([
      ["kind", "link"],
      ["token", "tok"],
      ["choice", "newsletter:email"],
      ["choice", "events:email"],
      ["choice", "volunteering:email"],
    ]);
  });

  it("stops everything", async () => {
    const done = await show(exampleSettings, null, actions(exampleNoBulk));
    await page.getByRole("button", { name: copy.stopAll.button }).click();
    await expect.element(page.getByRole("heading", { name: copy.noBulk.title })).toHaveFocus();
    expect(fields(done.stopAll.mock.calls[0][0])).toEqual([
      ["kind", "link"],
      ["token", "tok"],
    ]);
  });

  it("holds email under “No bulk emails”, which they can lift, and offers no Stop everything", async () => {
    const done = await show(exampleNoBulk, null, actions(exampleSettings));
    await expect.element(page.getByText(copy.noBulk.body(exampleNoBulk.hold!.at))).toBeVisible();
    await expect.element(card("newsletter").getByRole("checkbox", { name: copy.ways.email })).toBeDisabled();
    await expect.element(card("newsletter").getByText(copy.tags.on)).toBeVisible();
    await expect.element(card("events").getByText(copy.tags.paused)).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.stopAll.button })).not.toBeInTheDocument();
    await page.getByRole("button", { name: copy.noBulk.button }).click();
    await expect.element(page.getByRole("heading", { name: copy.noBulk.title })).not.toBeInTheDocument();
    await expect.element(page.getByRole("heading", { level: 1, name: copy.settings.title })).toHaveFocus();
    expect(done.lift).toHaveBeenCalledOnce();
  });

  it("says what holds it when only PauseAI Global can lift it, or it's blocked", async () => {
    await show(exampleDoNotEmail);
    await expect.element(page.getByRole("heading", { name: copy.doNotEmail.title })).toBeVisible();
    await expect.element(page.getByRole("button", { name: copy.noBulk.button })).not.toBeInTheDocument();
    await expect
      .element(
        card("newsletter").getByText(
          `${copy.why.yes} ${copy.why.reasons["signed-up"]!(copy.sourceWords("paper-signup"))}`,
        ),
      )
      .toBeVisible();
    await show(exampleBlocked);
    await expect.element(page.getByRole("heading", { name: copy.blocked.title })).toBeVisible();
  });

  it("from an email's link: its button first, then what it did and what they still get", async () => {
    const done = await show(exampleSettings, ["newsletter"], actions(exampleUnsubscribed));
    await expect
      .element(page.getByRole("heading", { name: copy.unsubscribe.title(copy.inSentence.newsletter) }))
      .toBeVisible();
    await page.getByRole("button", { name: copy.unsubscribe.button }).click();
    await expect
      .element(page.getByRole("heading", { name: copy.unsubscribe.done(copy.inSentence.newsletter) }))
      .toHaveFocus();
    await expect
      .element(page.getByText(copy.unsubscribe.still(copy.topics.events, copy.why.reasons.following!(""))))
      .toBeVisible();
    expect(fields(done.unsubscribe.mock.calls[0][0])).toEqual([
      ["kind", "copy"],
      ["token", "tok"],
    ]);
    await expect
      .element(
        card("newsletter").getByText(
          `${copy.why.no} ${settingsDate(exampleUnsubscribed.answers[0].at)}: ${copy.why.reasons.unsubscribed!(copy.sourceWords("link"))}`,
        ),
      )
      .toBeVisible();
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

  it("explains an answer it has no words for by nothing, and a no it has words for as they are", async () => {
    await show({
      ...exampleSettings,
      numbers: [],
      answers: [
        { ...exampleSettings.answers[0], send: "no", reason: "declined" },
        { ...exampleSettings.answers[0], topic: "events", send: "no", reason: "not-following", source: null },
        { ...exampleSettings.answers[0], topic: "volunteering", send: "yes", reason: "left", source: "nowhere" },
      ],
    });
    await expect
      .element(card("newsletter").getByText(copy.why.reasons.declined!(copy.sourceWords("march-2026-11"))))
      .toBeVisible();
    await expect.element(card("events").getByText(copy.why.nothing)).toBeVisible();
    await expect.element(card("volunteering").getByText(copy.why.yes)).toBeVisible();
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
