// Made-up contact preferences, as the page gets them, for the gallery and the tests.
import { refused } from "@/lib/form-result";
import type { ContactPermission } from "@/lib/supporters/contact-permissions";
import {
  choiceKey,
  hold,
  LUMA_CHOICE,
  LUMA_OFFERED,
  settingsTopics,
  type SettingsChanged,
  type SettingsView,
} from "@/lib/supporters/settings-view";

const AT = new Date("2026-11-02T10:00:00Z");
const JANE = "jane.smith@example.com";
const PHONE = "+447700900123";

const answer = (fields: Partial<ContactPermission>): ContactPermission => ({
  topic: "newsletter",
  way: "email",
  channel: "email",
  address: JANE,
  send: "yes",
  reason: "asked",
  at: AT,
  source: "march-2026-11",
  ...fields,
});

const view = (answers: ContactPermission[], numbers: string[] = [PHONE]): SettingsView => ({
  address: JANE,
  numbers,
  answers,
  hold: hold(answers),
  onLuma: answers.some((a) => a.topic === "events" && a.way === "email" && a.reason === "following"),
});

/** The newsletter by email and text from the march's box, events by email from following the Luma calendar. */
export const exampleSettings = view([
  answer({}),
  answer({ way: "text", channel: "phone", address: PHONE }),
  answer({ topic: "events", reason: "following", source: "luma" }),
]);

/**
 * Unsubscribed from PauseAI UK Updates by an email's link, which is a no to
 * events too, while still on our Luma calendar.
 */
export const exampleUnsubscribed: SettingsView = {
  ...view(
    [
      answer({ send: "no", reason: "unsubscribed", source: "link" }),
      answer({ topic: "events", send: "no", reason: "unsubscribed", source: "link" }),
    ],
    [],
  ),
  onLuma: true,
};

/** On our Luma calendar, with an old no to the newsletter: PauseAI UK Updates inc. Luma still reaches them. */
export const exampleOnlyLuma = view(
  [
    answer({ send: "no", reason: "unsubscribed", source: "link", at: new Date("2026-09-01T00:00:00Z") }),
    answer({ topic: "events", reason: "following", source: "luma" }),
  ],
  [],
);

/** "No bulk emails" in CiviCRM: the email boxes held, the newsletter still by text. */
export const exampleNoBulk = view([
  answer({ send: "no", reason: "no-bulk-email", source: "civicrm" }),
  answer({ topic: "events", send: "no", reason: "no-bulk-email", source: "civicrm" }),
  answer({ way: "text", channel: "phone", address: PHONE }),
]);

/** Stop everything pressed: "No bulk emails" that Restart undoes in full. */
export const exampleStopped: SettingsView = {
  ...exampleNoBulk,
  hold: { ...exampleNoBulk.hold!, source: "preferences", everything: true },
};

/** "Do not SMS" and "Do not phone" in CiviCRM on their only number: texts and calls locked. */
export const exampleNumberHolds = view([
  answer({}),
  answer({ way: "text", channel: "phone", address: PHONE, send: "no", reason: "do-not-sms", source: "civicrm" }),
  answer({ way: "call", channel: "phone", address: PHONE, send: "no", reason: "do-not-phone", source: "civicrm" }),
]);

/** A number's page, from the answer to its STOP: events stopped by the reply, the newsletter still by text. */
export const exampleNumber: SettingsView = {
  address: PHONE,
  numbers: [PHONE],
  onLuma: false,
  answers: [
    answer({ way: "text", channel: "phone", address: PHONE }),
    answer({
      topic: "events",
      way: "text",
      channel: "phone",
      address: PHONE,
      send: "no",
      reason: "unsubscribed",
      source: "whatsapp",
    }),
  ],
  hold: null,
};

/** "Do not email" in CiviCRM. */
export const exampleDoNotEmail = view([
  answer({ send: "no", reason: "do-not-email", source: "civicrm" }),
  answer({ way: "text", channel: "phone", address: PHONE, reason: "signed-up", source: "paper-signup" }),
]);

/** Our emails to the address bounced. */
export const exampleBlocked = view([answer({ send: "no", reason: "blocked", source: "hard" })], []);

/** On PauseAI Global's volunteering list, as its join form puts those who say they'd like to volunteer. */
export const exampleVolunteer = view([answer({ topic: "volunteering", reason: "subscribed", source: "civicrm" })]);

/**
 * `view` as saving a form of its boxes leaves it, as the page's save
 * answers: a yes or a no for each box that can be changed, and on our Luma
 * calendar or off it, where the page drew that box.
 */
export function exampleSaved(view: SettingsView, form: FormData): SettingsView {
  const ticked = new Set(form.getAll("choice").map(String));
  const answers = [...view.answers];
  for (const { topic, boxes } of settingsTopics(view)) {
    for (const { way } of boxes.filter((box) => !box.locked)) {
      const send = ticked.has(choiceKey(topic, way)) ? "yes" : "no";
      const at = answers.findIndex((a) => a.topic === topic && a.way === way);
      if (at >= 0) answers[at] = { ...answers[at], send };
      else answers.push(answer({ topic, way, send, source: "settings" }));
    }
  }
  return { ...view, answers, onLuma: ticked.has(LUMA_OFFERED) ? ticked.has(LUMA_CHOICE) : view.onLuma };
}

/** What a change answers: the page afresh as `view`, or for none, that its link has run out. */
export function exampleChanged(view: SettingsView | null): SettingsChanged {
  return view ? { ok: true, view } : refused("link-expired");
}
