import { hasWay, type ContactPermission, type Topic, type Way } from "./contact-permissions";

// What the contact preferences page shows for an address: PauseAI UK Updates and
// Volunteering, with a box for each way each goes by, ticked where we'd send
// it; why; whether Luma's own emails go to it; and what holds all of the
// address's email, which only that can lift, or nobody here can.

/** How long a link to the page asked for, or sent after a sign-up, works. */
export const LINK_DAYS = 7;

/**
 * What stops every email of ours to the address: "No bulk emails", which the
 * person can lift on the page; "Do not email", which only PauseAI Global
 * can; or the address blocked, as our emails to it bounced or were marked
 * as spam. `everything`, it's what Stop everything set, which Restart
 * undoes in full, texts and calls too.
 */
export type SettingsHold = {
  kind: "no-bulk" | "do-not-email" | "blocked";
  at: Date | null;
  source: string | null;
  everything: boolean;
};

/**
 * The address, its owner's numbers, every answer for each, and whether the
 * address is on our Luma calendar, so Luma's own emails go to it.
 */
export type SettingsView = {
  address: string;
  numbers: string[];
  answers: ContactPermission[];
  hold: SettingsHold | null;
  onLuma: boolean;
};

/** Whether a page is for a number alone, opened by the link a stop's answer gave it, rather than an email address. */
export const isNumber = (address: string): boolean => address.startsWith("+");

/** A box changed on the page: on is a yes, off an opt-out; Luma's, `events` by email, off takes them off our calendar. */
export type SettingsChoice = { topic: Topic; way: Way; on: boolean };

/** The topics the page has a card of, each with its boxes: Updates, the newsletter, and Volunteering. */
export const SETTINGS_TOPICS = ["newsletter", "volunteering"] as const;

/** The box for Luma's own emails, in a form: whether the address stays on our calendar. */
export const LUMA_CHOICE = "luma";

/**
 * Sent with the form whenever the page drew that box, so it being unticked
 * can be told from it not being there: a page opened before they joined the
 * calendar has none, and saving it must leave them on.
 */
export const LUMA_OFFERED = "luma-offered";

const HOLDS: Partial<Record<ContactPermission["reason"], SettingsHold["kind"]>> = {
  blocked: "blocked",
  "do-not-email": "do-not-email",
  "no-bulk-email": "no-bulk",
};

/** What holds every email to the address, from its answers: each topic's says so, as it stops them all. */
export function hold(answers: ContactPermission[]): SettingsHold | null {
  const held = answers.find((a) => a.way === "email" && HOLDS[a.reason]);
  return held ? { kind: HOLDS[held.reason]!, at: held.at, source: held.source, everything: false } : null;
}

/** What PauseAI Global's CiviCRM says stops a way to a number, which only Global can lift. */
const NUMBER_HOLDS = { text: "do-not-sms", call: "do-not-phone" } as const;

/**
 * The ways, texts or calls, that PauseAI Global stops to every one of the
 * owner's numbers ("Do not SMS", "Do not phone"): their boxes can't be
 * ticked, as a yes wouldn't send anything.
 */
export function numberHolds(view: Pick<SettingsView, "numbers" | "answers">): ("text" | "call")[] {
  return (["text", "call"] as const).filter(
    (way) =>
      view.numbers.length > 0 &&
      view.numbers.every((number) =>
        view.answers.some((a) => a.address === number && a.way === way && a.reason === NUMBER_HOLDS[way]),
      ),
  );
}

/** A box: the way, ticked or not, and whether it can be changed here. */
export type SettingsBox = { way: Way; on: boolean; locked: boolean };

/** A topic as the page shows it: its boxes, and the answer that says why it's on or off, if any does. */
export type SettingsTopic = { topic: Topic; boxes: SettingsBox[]; why: ContactPermission | null };

/** A box's name in a form: its topic and way. */
export const choiceKey = (topic: Topic, way: Way): string => `${topic}:${way}`;

/**
 * A topic's answers as the page counts them: `volunteering`'s own; for
 * PauseAI UK Updates, `newsletter`'s, or `events`' where that's a yes and
 * `newsletter`'s isn't, as either puts them on PauseAI UK Updates including
 * Luma, which we send them.
 */
export function topicAnswers(view: Pick<SettingsView, "answers">, topic: Topic): ContactPermission[] {
  const own = view.answers.filter((a) => a.topic === topic);
  if (topic !== "newsletter") return own;
  const luma = view.answers.filter((a) => a.topic === "events" && a.send === "yes");
  const same = (a: ContactPermission) => (b: ContactPermission) => a.way === b.way && a.address === b.address;
  return [
    ...own.map((a) => (a.send === "yes" ? a : (luma.find(same(a)) ?? a))),
    ...luma.filter((a) => !own.some(same(a))),
  ];
}

/**
 * Updates and Volunteering, each with a box for email, but on a number's
 * page, and for texts and calls where the topic goes by them and the owner
 * has a number: ticked where any number says yes. Email can't be changed
 * while all its email is held, nor texts or calls while PauseAI Global
 * stops them (numberHolds). Why is the email's answer, or else a number's
 * yes, or else the email's no; on a number's page, which has no email, its
 * text's no, or else its call's.
 */
export function settingsTopics(view: SettingsView): SettingsTopic[] {
  const stopped: Way[] = numberHolds(view);
  const forNumber = isNumber(view.address);
  return SETTINGS_TOPICS.map((topic) => {
    const own = topicAnswers(view, topic);
    const ways: Way[] = [
      ...(forNumber ? [] : (["email"] as const)),
      ...(view.numbers.length ? (["text", "call"] as const) : []),
    ];
    const boxes = ways
      .filter((way) => hasWay(topic, way))
      .map((way) => ({
        way,
        on: own.some((a) => a.way === way && a.send === "yes"),
        // Stop everything stops every text and call too, till Restart.
        locked: way === "email" ? view.hold !== null : stopped.includes(way) || Boolean(view.hold?.everything),
      }));
    const email = forNumber
      ? (own.find((a) => a.way === "text") ?? own[0])
      : own.find((a) => a.way === "email" && !HOLDS[a.reason]);
    const why = email?.send === "yes" ? email : (own.find((a) => a.send === "yes") ?? email ?? null);
    return { topic, boxes, why };
  });
}
