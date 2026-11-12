// Made-up contact preferences, as the page gets them, for the gallery and the tests.
import type { ContactPermission } from "@/lib/contact-permissions";
import { hold, type SettingsView } from "@/lib/email-settings";

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
});

/** The newsletter by email and text from the march's box, events by email from following the Luma calendar. */
export const exampleSettings = view([
  answer({}),
  answer({ way: "text", channel: "phone", address: PHONE }),
  answer({ topic: "events", reason: "following", source: "luma" }),
]);

/** Unsubscribed from the newsletter by an email's link, still following the calendar. */
export const exampleUnsubscribed = view(
  [
    answer({ send: "no", reason: "unsubscribed", source: "link" }),
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

/** "Do not email" in CiviCRM. */
export const exampleDoNotEmail = view([
  answer({ send: "no", reason: "do-not-email", source: "civicrm" }),
  answer({ way: "text", channel: "phone", address: PHONE, reason: "signed-up", source: "paper-signup" }),
]);

/** Our emails to the address bounced. */
export const exampleBlocked = view([answer({ send: "no", reason: "blocked", source: "hard" })], []);
